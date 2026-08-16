import { supabase } from "./supabase";

const STORAGE_KEY_PREFIX = "finance-app:data";

function getUserStorageKey(userId) {
  return `${STORAGE_KEY_PREFIX}:${userId}`;
}

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

function loadLocal(storageKey, defaultData) {
  try {
    const raw = window.localStorage.getItem(storageKey);

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

function saveLocal(storageKey, data) {
  try {
    window.localStorage.setItem(
      storageKey,
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
  const user = await getAuthenticatedUser();

  if (!user) {
    return defaultData;
  }

  const storageKey = getUserStorageKey(user.id);

  const localData = loadLocal(
    storageKey,
    defaultData
  );

  const cloudResult = await readCloud(
    user.id,
    defaultData
  );

  if (!cloudResult.success) {
    return localData;
  }

  const cloudData = cloudResult.data;

  if (hasMeaningfulData(cloudData)) {
    saveLocal(
      storageKey,
      cloudData
    );

    return cloudData;
  }

  if (hasMeaningfulData(localData)) {
    const migrated = await writeCloud(
      user.id,
      localData
    );

    if (migrated) {
      console.log(
        "User-scoped local Ledger data migrated to Supabase."
      );
    }

    return localData;
  }

  return defaultData;
}

export async function saveLedgerData(data) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      localSaved: false,
      cloudSaved: false
    };
  }

  const storageKey = getUserStorageKey(
    user.id
  );

  const localSaved = saveLocal(
    storageKey,
    data
  );

  const cloudSaved = await writeCloud(
    user.id,
    data
  );

  return {
    localSaved,
    cloudSaved
  };
}
