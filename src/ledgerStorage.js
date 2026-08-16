import { supabase } from "./supabase";

const STORAGE_KEY = "finance-app:data";

/*
 * This helper keeps localStorage as the safety copy.
 *
 * LOAD:
 * 1. Read local data first.
 * 2. Try Supabase.
 * 3. If cloud has real data, use cloud.
 * 4. If cloud is empty but local has data, migrate local to cloud.
 * 5. If Supabase fails, keep using local data.
 *
 * SAVE:
 * 1. Save locally first.
 * 2. Then try Supabase.
 * 3. If cloud save fails, the local copy still survives.
 */

function mergeWithDefaults(defaultData, savedData) {
  return {
    ...defaultData,
    ...(savedData || {}),
    settings: {
      ...(defaultData.settings || {}),
      ...(savedData?.settings || {})
    },
    budgets: {
      ...(defaultData.budgets || {}),
      ...(savedData?.budgets || {})
    }
  };
}

function hasMeaningfulData(data) {
  if (!data) return false;

  return (
    (data.accounts?.length || 0) > 0 ||
    (data.transactions?.length || 0) > 0 ||
    (data.notes?.length || 0) > 0 ||
    (data.recurringRules?.length || 0) > 0 ||
    Object.keys(data.budgets || {}).length > 0 ||
    data.onboardingDone === true
  );
}

function loadLocal(defaultData) {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return defaultData;
    }

    const parsed = JSON.parse(raw);

    return mergeWithDefaults(defaultData, parsed);
  } catch (error) {
    console.error("Local Ledger load failed:", error);
    return defaultData;
  }
}

function saveLocal(data) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(data)
    );

    return true;
  } catch (error) {
    console.error("Local Ledger save failed:", error);
    return false;
  }
}

async function getAuthenticatedUser() {
  try {
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    if (error) {
      console.error("Could not get authenticated user:", error);
      return null;
    }

    return user || null;
  } catch (error) {
    console.error("Could not get authenticated user:", error);
    return null;
  }
}

async function readCloud(userId, defaultData) {
  try {
    const { data: row, error } = await supabase
      .from("user_finance_data")
      .select("data, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Cloud Ledger load failed:", error);
      return {
        success: false,
        data: null
      };
    }

    if (!row?.data) {
      return {
        success: true,
        data: null
      };
    }

    return {
      success: true,
      data: mergeWithDefaults(
        defaultData,
        row.data
      )
    };
  } catch (error) {
    console.error("Cloud Ledger load failed:", error);

    return {
      success: false,
      data: null
    };
  }
}

async function writeCloud(userId, data) {
  try {
    const { error } = await supabase
      .from("user_finance_data")
      .upsert(
        {
          user_id: userId,
          data,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: "user_id"
        }
      );

    if (error) {
      console.error("Cloud Ledger save failed:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Cloud Ledger save failed:", error);
    return false;
  }
}

export async function loadLedgerData(defaultData) {
  /*
   * IMPORTANT:
   * Local data is read BEFORE contacting Supabase.
   * This is the safety mechanism that prevents
   * a cloud failure from making the Ledger look empty.
   */

  const localData = loadLocal(defaultData);

  const user = await getAuthenticatedUser();

  if (!user) {
    return localData;
  }

  const cloudResult = await readCloud(
    user.id,
    defaultData
  );

  /*
   * Supabase could not be reached or rejected
   * the request. Keep using the local copy.
   */
  if (!cloudResult.success) {
    return localData;
  }

  const cloudData = cloudResult.data;

  /*
   * If cloud already contains meaningful Ledger data,
   * cloud becomes the source of truth.
   *
   * Also refresh the local safety copy.
   */
  if (hasMeaningfulData(cloudData)) {
    saveLocal(cloudData);
    return cloudData;
  }

  /*
   * Cloud is empty, but this browser already has
   * Ledger information.
   *
   * Migrate the local data to Supabase instead
   * of replacing it with an empty cloud record.
   */
  if (hasMeaningfulData(localData)) {
    const migrated = await writeCloud(
      user.id,
      localData
    );

    if (migrated) {
      console.log(
        "Existing local Ledger data migrated to Supabase."
      );
    }

    return localData;
  }

  /*
   * Both cloud and local are empty.
   */
  return cloudData || localData;
}

export async function saveLedgerData(data) {
  /*
   * LOCAL FIRST.
   *
   * Even if Supabase is unavailable,
   * this browser keeps the latest Ledger data.
   */
  saveLocal(data);

  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      localSaved: true,
      cloudSaved: false
    };
  }

  const cloudSaved = await writeCloud(
    user.id,
    data
  );

  return {
    localSaved: true,
    cloudSaved
  };
}
