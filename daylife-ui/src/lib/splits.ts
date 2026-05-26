import type { SplitMode, StoredExpense, Settlement, User } from './api';

export interface SplitShare {
  userId: string;
  amount: number;
}

export interface SimplifiedDebt {
  fromUserId: string;
  toUserId: string;
  amount: number;
}

export function computeSplitShares(
  total: number,
  mode: SplitMode,
  participantIds: string[],
  exactShares?: Record<string, string>,
): SplitShare[] {
  if (participantIds.length === 0) return [];

  if (mode === 'EXACT' && exactShares) {
    return participantIds.map((userId) => ({
      userId,
      amount: parseFloat(exactShares[userId] || '0'),
    }));
  }

  const cents = Math.round(total * 100);
  const base = Math.floor(cents / participantIds.length);
  let remainder = cents - base * participantIds.length;

  return participantIds.map((userId) => {
    let shareCents = base;
    if (remainder > 0) {
      shareCents += 1;
      remainder -= 1;
    }
    return { userId, amount: shareCents / 100 };
  });
}

export function getExpenseShares(expense: StoredExpense): SplitShare[] {
  if (!expense.isShared) return [];
  const participants = expense.participantIds || [];
  const total = parseFloat(expense.amount);
  return computeSplitShares(total, expense.splitMode || 'EQUAL', participants, expense.shares);
}

export function computeNetBalances(
  users: User[],
  expenses: StoredExpense[],
  settlements: Settlement[],
): Record<string, number> {
  const balances: Record<string, number> = {};
  users.forEach((u) => {
    balances[u.id] = 0;
  });

  for (const expense of expenses) {
    if (!expense.isShared) continue;
    const shares = getExpenseShares(expense);
    for (const share of shares) {
      if (balances[share.userId] == null) balances[share.userId] = 0;
      balances[share.userId] -= share.amount;
    }
    if (balances[expense.paidById] == null) balances[expense.paidById] = 0;
    balances[expense.paidById] += parseFloat(expense.amount);
  }

  for (const settlement of settlements) {
    if (balances[settlement.fromUserId] == null) balances[settlement.fromUserId] = 0;
    if (balances[settlement.toUserId] == null) balances[settlement.toUserId] = 0;
    const amount = parseFloat(settlement.amount);
    balances[settlement.fromUserId] += amount;
    balances[settlement.toUserId] -= amount;
  }

  return balances;
}

export function simplifyDebts(balances: Record<string, number>): SimplifiedDebt[] {
  const creditors: Array<{ userId: string; amount: number }> = [];
  const debtors: Array<{ userId: string; amount: number }> = [];

  for (const [userId, balance] of Object.entries(balances)) {
    const rounded = Math.round(balance * 100) / 100;
    if (rounded > 0.005) creditors.push({ userId, amount: rounded });
    if (rounded < -0.005) debtors.push({ userId, amount: -rounded });
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const debts: SimplifiedDebt[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const transfer = Math.min(debtors[i].amount, creditors[j].amount);
    if (transfer > 0.005) {
      debts.push({
        fromUserId: debtors[i].userId,
        toUserId: creditors[j].userId,
        amount: Math.round(transfer * 100) / 100,
      });
    }
    debtors[i].amount -= transfer;
    creditors[j].amount -= transfer;
    if (debtors[i].amount <= 0.005) i += 1;
    if (creditors[j].amount <= 0.005) j += 1;
  }

  return debts;
}

export function formatBalance(amount: number): string {
  return (Math.round(amount * 100) / 100).toFixed(2);
}
