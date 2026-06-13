import { prisma } from './prisma'
import { sendICVoteRequest } from './email'

/**
 * Calculate IC committee outcome based on votes
 */
export function calculateCommitteeOutcome(votes: Array<{
  vote: string
  userId: string
}>, quorumRequired: number): {
  outcome: 'APPROVED' | 'REJECTED' | 'DEFERRED' | null
  summary: {
    approve: number
    reject: number
    abstain: number
    defer: number
    pending: number
  }
  quorumMet: boolean
} {
  const summary = {
    approve: votes.filter(v => v.vote === 'APPROVE').length,
    reject: votes.filter(v => v.vote === 'REJECT').length,
    abstain: votes.filter(v => v.vote === 'ABSTAIN').length,
    defer: votes.filter(v => v.vote === 'DEFER').length,
    pending: votes.filter(v => !v.vote).length,
  }

  const totalVotes = summary.approve + summary.reject + summary.abstain + summary.defer
  const quorumMet = totalVotes >= quorumRequired

  let outcome: 'APPROVED' | 'REJECTED' | 'DEFERRED' | null = null

  if (quorumMet) {
    // Majority of non-abstain votes
    const decisiveVotes = summary.approve + summary.reject + summary.defer
    if (decisiveVotes === 0) {
      outcome = 'DEFERRED' // All abstained
    } else if (summary.defer > decisiveVotes / 2) {
      outcome = 'DEFERRED'
    } else if (summary.approve > summary.reject) {
      outcome = 'APPROVED'
    } else if (summary.reject > summary.approve) {
      outcome = 'REJECTED'
    } else {
      outcome = 'DEFERRED' // Tie
    }
  }

  return { outcome, summary, quorumMet }
}

/**
 * Send vote request emails to all committee members
 */
export async function sendVoteRequests(committeeId: string): Promise<void> {
  const committee = await prisma.icCommittee.findUnique({
    where: { id: committeeId },
    include: {
      project: true,
      votes: {
        include: { user: true },
      },
    },
  })

  if (!committee) {
    throw new Error('Committee not found')
  }

  if (committee.votesSent) {
    console.log(`[sendVoteRequests] Votes already sent for committee ${committeeId}`)
    return
  }

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const dueDate = committee.votingDeadline
    ? new Date(committee.votingDeadline).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'TBD'

  // Send to all committee members who haven't voted yet
  for (const vote of committee.votes) {
    if (!vote.votedAt) {
      await sendICVoteRequest({
        to: vote.user.email || '',
        committeeUserName: vote.user.name || vote.user.email || 'Committee Member',
        projectName: committee.project?.title || committee.name,
        projectCode: committee.project?.code || 'N/A',
        voteUrl: `${baseUrl}/dashboard/ic-committees/${committeeId}`,
        dueDate,
      }).catch(err => {
        console.error(`[sendVoteRequests] Failed to send to ${vote.user.email}:`, err)
      })
    }
  }

  // Mark as sent
  await prisma.icCommittee.update({
    where: { id: committeeId },
    data: { votesSent: true },
  })
}

/**
 * Send reminder emails to members who haven't voted
 */
export async function sendVoteReminders(committeeId: string): Promise<void> {
  const committee = await prisma.icCommittee.findUnique({
    where: { id: committeeId },
    include: {
      project: true,
      votes: {
        where: { votedAt: null },
        include: { user: true },
      },
    },
  })

  if (!committee) return

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const dueDate = committee.votingDeadline
    ? new Date(committee.votingDeadline).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'TBD'

  for (const vote of committee.votes) {
    if (!vote.reminderSent) {
      await sendICVoteRequest({
        to: vote.user.email || '',
        committeeUserName: vote.user.name || vote.user.email || 'Committee Member',
        projectName: committee.project?.title || committee.name,
        projectCode: committee.project?.code || 'N/A',
        voteUrl: `${baseUrl}/dashboard/ic-committees/${committeeId}`,
        dueDate,
      }).catch(err => {
        console.error(`[sendVoteReminders] Failed to send to ${vote.user.email}:`, err)
      })

      await prisma.icVote.update({
        where: { id: vote.id },
        data: { reminderSent: true },
      })
    }
  }
}

/**
 * Auto-close committee voting and calculate outcome
 */
export async function autoCloseCommittee(committeeId: string): Promise<void> {
  const committee = await prisma.icCommittee.findUnique({
    where: { id: committeeId },
    include: {
      votes: true,
    },
  })

  if (!committee || committee.status === 'COMPLETED') return

  const { outcome, summary, quorumMet } = calculateCommitteeOutcome(
    committee.votes,
    committee.quorumRequired
  )

  await prisma.icCommittee.update({
    where: { id: committeeId },
    data: {
      status: 'COMPLETED',
      outcome: outcome || 'DEFERRED',
      outcomeNotes: `Auto-closed: ${summary.approve} approve, ${summary.reject} reject, ${summary.abstain} abstain, ${summary.defer} defer. Quorum ${quorumMet ? 'met' : 'not met'}.`,
    },
  })
}

/**
 * Process pending IC committees (cron job function)
 * - Send reminders 24h before deadline
 * - Auto-close committees past deadline
 */
export async function processPendingCommittees(): Promise<void> {
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  // Auto-close committees past deadline
  const expiredCommittees = await prisma.icCommittee.findMany({
    where: {
      status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
      autoCloseAt: { lte: now },
    },
  })

  for (const committee of expiredCommittees) {
    console.log(`[processPendingCommittees] Auto-closing committee ${committee.id}`)
    await autoCloseCommittee(committee.id)
  }

  // Send reminders for committees with deadline in 24h
  const upcomingCommittees = await prisma.icCommittee.findMany({
    where: {
      status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
      votingDeadline: {
        gte: now,
        lte: tomorrow,
      },
    },
  })

  for (const committee of upcomingCommittees) {
    console.log(`[processPendingCommittees] Sending reminders for committee ${committee.id}`)
    await sendVoteReminders(committee.id)
  }
}
