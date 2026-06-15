import { useEffect, useMemo, useRef, useState } from "react";
import {
  calculateBudget,
  createId,
  getAvailableMonths,
  loadBudgetData,
  normalizeBudgetData,
  resetBudgetData,
  saveBudgetData,
  todayISO,
} from "./budgetData";
import { supabase } from "./supabaseClient";

const prefixByType = {
  transactions: "tx",
  income: "inc",
  savings: "sav",
  reimbursements: "reb",
};

export function useBudget() {
  const [data, setData] = useState(loadBudgetData);
  const [selectedMonth, setSelectedMonth] = useState(() => getAvailableMonths(loadBudgetData())[0] || todayISO().slice(0, 7));
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState("Local only");
  const cloudLoadRef = useRef(false);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    saveBudgetData(data);
  }, [data]);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const { data: authData } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(authData.session || null);
      setAuthLoading(false);
    }

    loadSession();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setSyncStatus("Local only");
      return;
    }

    let cancelled = false;

    async function loadCloudBudget() {
      cloudLoadRef.current = true;
      setSyncStatus("Loading cloud data...");

      const { data: profile, error } = await supabase
        .from("budget_profiles")
        .select("data")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setSyncStatus(error.message);
        cloudLoadRef.current = false;
        return;
      }

      if (profile?.data) {
        const normalized = normalizeBudgetData(profile.data);
        setData(normalized);
        setSelectedMonth(getAvailableMonths(normalized)[0] || todayISO().slice(0, 7));
        setSyncStatus("Synced");
      } else {
        await saveCloudBudget(data, session.user.id);
        if (!cancelled) setSyncStatus("Synced");
      }

      cloudLoadRef.current = false;
    }

    loadCloudBudget();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user || cloudLoadRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    setSyncStatus("Saving...");
    saveTimerRef.current = setTimeout(async () => {
      const { error } = await saveCloudBudget(data, session.user.id);
      setSyncStatus(error ? error.message : "Synced");
    }, 700);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [data, session?.user?.id]);

  const months = useMemo(() => getAvailableMonths(data), [data]);
  const budget = useMemo(() => calculateBudget(data, selectedMonth), [data, selectedMonth]);

  function addRecord(type, record) {
    setData((current) => ({
      ...current,
      [type]: [{ ...record, id: createId(prefixByType[type]) }, ...current[type]],
    }));
  }

  function updateRecord(type, id, changes) {
    setData((current) => ({
      ...current,
      [type]: current[type].map((item) => (item.id === id ? { ...item, ...changes } : item)),
    }));
  }

  function deleteRecord(type, id) {
    setData((current) => ({
      ...current,
      [type]: current[type].filter((item) => item.id !== id),
    }));
  }

  function duplicateRecord(type, record) {
    const copy = { ...record };
    if (type === "reimbursements") copy.datePaid = todayISO();
    else copy.date = todayISO();
    delete copy.id;
    addRecord(type, copy);
  }

  function addListItem(listName, value) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setData((current) => {
      const existing = current.lists[listName] || [];
      if (existing.some((item) => item.toLowerCase() === trimmed.toLowerCase())) return current;
      return {
        ...current,
        lists: { ...current.lists, [listName]: [...existing, trimmed] },
      };
    });
  }

  function removeListItem(listName, value) {
    setData((current) => ({
      ...current,
      lists: {
        ...current.lists,
        [listName]: current.lists[listName].filter((item) => item !== value),
      },
    }));
  }

  function updateTarget(key, value) {
    setData((current) => ({
      ...current,
      targets: {
        ...current.targets,
        [key]: value,
      },
    }));
  }

  function updateCategoryBudget(category, value) {
    setData((current) => ({
      ...current,
      targets: {
        ...current.targets,
        categoryBudgets: {
          ...(current.targets?.categoryBudgets || {}),
          [category]: Number(value || 0),
        },
      },
    }));
  }

  function importData(nextData) {
    const normalized = normalizeBudgetData(nextData);
    setData(normalized);
    setSelectedMonth(getAvailableMonths(normalized)[0] || todayISO().slice(0, 7));
  }

  async function signUp(email, password) {
    setSyncStatus("Creating account...");
    const { error } = await supabase.auth.signUp({ email, password });
    setSyncStatus(error ? error.message : "Check your email to confirm your account.");
    return { error };
  }

  async function signIn(email, password) {
    setSyncStatus("Signing in...");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSyncStatus(error ? error.message : "Signed in");
    return { error };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setSyncStatus("Local only");
  }

  function resetData() {
    const next = resetBudgetData();
    setData(next);
    setSelectedMonth(getAvailableMonths(next)[0] || todayISO().slice(0, 7));
  }

  return {
    data,
    setData,
    user: session?.user || null,
    authLoading,
    syncStatus,
    selectedMonth,
    setSelectedMonth,
    months,
    budget,
    addRecord,
    updateRecord,
    deleteRecord,
    duplicateRecord,
    addListItem,
    removeListItem,
    updateTarget,
    updateCategoryBudget,
    importData,
    signUp,
    signIn,
    signOut,
    resetData,
  };
}

async function saveCloudBudget(data, userId) {
  return supabase.from("budget_profiles").upsert({
    user_id: userId,
    data,
  });
}
