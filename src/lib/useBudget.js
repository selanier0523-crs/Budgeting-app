import { useEffect, useMemo, useRef, useState } from "react";
import {
  calculateBudget,
  createId,
  getAvailableMonths,
  getTransactionReimbursementComputed,
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
  savingsBuckets: "bucket",
};

export function useBudget() {
  const [data, setData] = useState(loadBudgetData);
  const [selectedMonth, setSelectedMonth] = useState(() => getAvailableMonths(loadBudgetData())[0] || todayISO().slice(0, 7));
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState("Local only");
  const [households, setHouseholds] = useState([]);
  const [activeHouseholdId, setActiveHouseholdId] = useState("");
  const [householdMembers, setHouseholdMembers] = useState([]);
  const [householdProfiles, setHouseholdProfiles] = useState([]);
  const [householdStatus, setHouseholdStatus] = useState("Sign in to connect household accounts.");
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
      setHouseholds([]);
      setActiveHouseholdId("");
      setHouseholdMembers([]);
      setHouseholdProfiles([]);
      setHouseholdStatus("Sign in to connect household accounts.");
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
    if (!session?.user) return;
    loadHouseholds();
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user || !activeHouseholdId) {
      setHouseholdMembers([]);
      setHouseholdProfiles([]);
      return;
    }

    loadHouseholdDetails(activeHouseholdId);
  }, [session?.user?.id, activeHouseholdId, data]);

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
    setData((current) => {
      const nextRecord = { ...record, id: createId(prefixByType[type]) };
      const nextData = {
        ...current,
        [type]: [nextRecord, ...current[type]],
      };
      return type === "transactions" ? syncLinkedTransactionReimbursement(nextData, nextRecord) : nextData;
    });
  }

  function updateRecord(type, id, changes) {
    setData((current) => {
      const nextRecord = { ...current[type].find((item) => item.id === id), ...changes };
      const nextData = {
        ...current,
        [type]: current[type].map((item) => (item.id === id ? nextRecord : item)),
      };
      if (type === "transactions") return syncLinkedTransactionReimbursement(nextData, nextRecord);
      if (type === "reimbursements" && nextRecord.sourceTransactionId) return syncTransactionFromLinkedReimbursement(nextData, nextRecord);
      return nextData;
    });
  }

  function deleteRecord(type, id) {
    setData((current) => {
      if (type === "transactions") {
        return {
          ...current,
          transactions: current.transactions.filter((item) => item.id !== id),
          reimbursements: current.reimbursements.filter((item) => item.sourceTransactionId !== id),
        };
      }

      return {
        ...current,
        [type]: current[type].filter((item) => item.id !== id),
      };
    });
  }

  function duplicateRecord(type, record) {
    const copy = { ...record };
    if (type === "reimbursements") copy.datePaid = todayISO();
    else copy.date = todayISO();
    delete copy.id;
    addRecord(type, copy);
  }

  function addSavingsBucket(bucket) {
    setData((current) => ({
      ...current,
      savingsBuckets: [{ ...bucket, id: createId(prefixByType.savingsBuckets) }, ...(current.savingsBuckets || [])],
    }));
  }

  function updateSavingsBucket(id, changes) {
    setData((current) => ({
      ...current,
      savingsBuckets: (current.savingsBuckets || []).map((bucket) => (bucket.id === id ? { ...bucket, ...changes } : bucket)),
    }));
  }

  function deleteSavingsBucket(id) {
    setData((current) => ({
      ...current,
      savingsBuckets: (current.savingsBuckets || []).filter((bucket) => bucket.id !== id),
      savings: current.savings.map((item) => (item.bucketId === id ? { ...item, bucketId: "" } : item)),
      transactions: current.transactions.map((item) =>
        item.savingsBucketId === id ? { ...item, savingsBucketId: "", bucketAmountUsed: 0 } : item,
      ),
    }));
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

  async function loadHouseholds() {
    setHouseholdStatus("Loading household...");
    const { data: memberships, error } = await supabase
      .from("budget_household_members")
      .select("household_id, role, display_name, budget_households(id, name, owner_id)")
      .eq("user_id", session.user.id);

    if (error) {
      setHouseholdStatus(error.message);
      return;
    }

    const nextHouseholds = (memberships || [])
      .map((membership) => ({
        id: membership.budget_households?.id || membership.household_id,
        name: membership.budget_households?.name || "Household",
        ownerId: membership.budget_households?.owner_id,
        role: membership.role,
        displayName: membership.display_name,
      }))
      .filter((household) => household.id);

    setHouseholds(nextHouseholds);
    setActiveHouseholdId((current) => {
      if (current && nextHouseholds.some((household) => household.id === current)) return current;
      return nextHouseholds[0]?.id || "";
    });
    setHouseholdStatus(nextHouseholds.length > 0 ? "Household connected" : "No household connected yet.");
  }

  async function loadHouseholdDetails(householdId) {
    setHouseholdStatus("Loading household...");
    const { data: members, error: memberError } = await supabase
      .from("budget_household_members")
      .select("household_id, user_id, display_name, role, created_at")
      .eq("household_id", householdId)
      .order("created_at", { ascending: true });

    if (memberError) {
      setHouseholdStatus(memberError.message);
      return;
    }

    const userIds = (members || []).map((member) => member.user_id);
    const { data: profiles, error: profileError } = await supabase
      .from("budget_profiles")
      .select("user_id, data")
      .in("user_id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

    if (profileError) {
      setHouseholdStatus(profileError.message);
      return;
    }

    setHouseholdMembers(members || []);
    const profileMap = new Map((profiles || []).map((profile) => [profile.user_id, normalizeBudgetData(profile.data)]));
    if (session?.user?.id) profileMap.set(session.user.id, normalizeBudgetData(data));
    setHouseholdProfiles(userIds.map((userId) => ({ userId, data: profileMap.get(userId) || normalizeBudgetData({}) })));
    setHouseholdStatus("Household synced");
  }

  async function createHousehold(name, displayName) {
    if (!session?.user) return { error: new Error("Sign in first.") };
    setHouseholdStatus("Creating household...");
    const { data: household, error } = await supabase
      .from("budget_households")
      .insert({ name: name.trim() || "My Household", owner_id: session.user.id })
      .select("id")
      .single();

    if (error) {
      setHouseholdStatus(error.message);
      return { error };
    }

    const { error: memberError } = await supabase.from("budget_household_members").insert({
      household_id: household.id,
      user_id: session.user.id,
      display_name: displayName.trim() || session.user.email || "Me",
      role: "owner",
    });

    if (memberError) {
      setHouseholdStatus(memberError.message);
      return { error: memberError };
    }

    await loadHouseholds();
    setActiveHouseholdId(household.id);
    setHouseholdStatus("Household created");
    return { error: null };
  }

  async function joinHousehold(householdId, displayName) {
    if (!session?.user) return { error: new Error("Sign in first.") };
    setHouseholdStatus("Joining household...");
    const cleanHouseholdId = householdId.trim();
    const { error } = await supabase.from("budget_household_members").insert({
      household_id: cleanHouseholdId,
      user_id: session.user.id,
      display_name: displayName.trim() || session.user.email || "Me",
      role: "member",
    });

    if (error) {
      setHouseholdStatus(error.message);
      return { error };
    }

    await loadHouseholds();
    setActiveHouseholdId(cleanHouseholdId);
    setHouseholdStatus("Household joined");
    return { error: null };
  }

  async function leaveHousehold(householdId) {
    if (!session?.user) return;
    setHouseholdStatus("Leaving household...");
    const { error } = await supabase
      .from("budget_household_members")
      .delete()
      .eq("household_id", householdId)
      .eq("user_id", session.user.id);

    setHouseholdStatus(error ? error.message : "Left household");
    await loadHouseholds();
  }

  function resetData() {
    const next = resetBudgetData(data);
    setData(next);
    setSelectedMonth(getAvailableMonths(next)[0] || todayISO().slice(0, 7));
  }

  return {
    data,
    setData,
    user: session?.user || null,
    authLoading,
    syncStatus,
    households,
    activeHouseholdId,
    setActiveHouseholdId,
    householdMembers,
    householdProfiles,
    householdStatus,
    selectedMonth,
    setSelectedMonth,
    months,
    budget,
    addRecord,
    updateRecord,
    deleteRecord,
    duplicateRecord,
    addSavingsBucket,
    updateSavingsBucket,
    deleteSavingsBucket,
    addListItem,
    removeListItem,
    updateTarget,
    updateCategoryBudget,
    importData,
    signUp,
    signIn,
    signOut,
    createHousehold,
    joinHousehold,
    leaveHousehold,
    resetData,
  };
}

async function saveCloudBudget(data, userId) {
  return supabase.from("budget_profiles").upsert({
    user_id: userId,
    data,
  });
}

function syncLinkedTransactionReimbursement(data, transaction) {
  const computed = getTransactionReimbursementComputed(transaction);
  const existing = data.reimbursements.find((item) => item.sourceTransactionId === transaction.id);
  const remainingReimbursements = data.reimbursements.filter((item) => item.sourceTransactionId !== transaction.id);

  if (!transaction.paidForSomeone || computed.stillOwed <= 0) {
    return { ...data, reimbursements: remainingReimbursements };
  }

  const linkedReimbursement = {
    id: existing?.id || createId("reb"),
    sourceTransactionId: transaction.id,
    datePaid: transaction.date || todayISO(),
    person: transaction.personOwes || "Someone",
    description: transaction.description || "Paid for someone",
    amountPaid: computed.amountOwed,
    amountPaidBack: computed.paidBack,
    datePaidBack: transaction.datePaidBack || "",
    paymentMethod: transaction.reimbursementPaymentMethod || "",
    notes: transaction.reimbursementNotes || "",
  };

  return {
    ...data,
    reimbursements: [linkedReimbursement, ...remainingReimbursements],
  };
}

function syncTransactionFromLinkedReimbursement(data, reimbursement) {
  const nextData = {
    ...data,
    transactions: data.transactions.map((transaction) =>
      transaction.id === reimbursement.sourceTransactionId
        ? {
            ...transaction,
            amountPaidBack: Number(reimbursement.amountPaidBack || 0),
            datePaidBack: reimbursement.datePaidBack || "",
            reimbursementPaymentMethod: reimbursement.paymentMethod || transaction.reimbursementPaymentMethod || "",
          }
        : transaction,
    ),
  };
  const transaction = nextData.transactions.find((item) => item.id === reimbursement.sourceTransactionId);
  return transaction ? syncLinkedTransactionReimbursement(nextData, transaction) : nextData;
}
