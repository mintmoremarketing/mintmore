const notificationService = require('./notification.service');
const { query } = require('../../config/database');

const money = (amount) => `INR ${Number(amount || 0).toLocaleString('en-IN')}`;

const getActiveAdminIds = async () => {
  const admins = await query(`SELECT id FROM users WHERE role = 'admin' AND is_active = true`);
  return admins.rows.map((admin) => admin.id);
};

const notifyMatchedCandidates = async (job, candidates) => {
  if (!candidates || candidates.length === 0) return;

  const primary = candidates.find((candidate) => candidate.rank === 1);
  if (!primary) return;
  const notifications = [{
    userId:     primary.freelancer_id,
    type:       'job_matched',
    title:      'New brief matched',
    body:       `You have been matched to "${job.title}". Open your dashboard to respond.`,
    entityType: 'job',
    entityId:   job.id,
    data: {
      job_id:       job.id,
      job_title:    job.title,
      pricing_mode: job.pricing_mode,
    },
  }];

  await notificationService.createBulkNotifications(notifications);
};

const notifyPromotedPrimary = async (job, fallback) => {
  if (fallback?.action !== 'promoted_backup' || !fallback.next_freelancer_id) return;

  await notificationService.createNotification({
    userId:     fallback.next_freelancer_id,
    type:       'job_matched',
    title:      'New brief matched',
    body:       `You have been matched to "${job.title}". Open your dashboard to respond.`,
    entityType: 'job',
    entityId:   job.id,
    data: {
      job_id:       job.id,
      job_title:    job.title,
      pricing_mode: job.pricing_mode,
    },
  });
};

const notifyNegotiationInitiated = async ({ job, freelancer, proposed_price }) => {
  await notificationService.createNotification({
    userId:     job.client_id,
    type:       'negotiation_initiated',
    title:      'New offer received',
    body:       `A CREATYV creative sent an offer for "${job.title}" at ${money(proposed_price)}.`,
    entityType: 'job',
    entityId:   job.id,
    data: {
      job_id:          job.id,
      job_title:       job.title,
      proposed_price,
    },
  });
};

const notifyNegotiationCountered = async ({
  job,
  senderName,
  recipientUserId,
  round_number,
  proposed_price,
  maskSender = false,
}) => {
  const visibleSenderName = maskSender ? 'A CREATYV creative' : senderName;
  await notificationService.createNotification({
    userId:     recipientUserId,
    type:       'negotiation_countered',
    title:      'Counter offer received',
    body:       `${visibleSenderName} sent a counter offer of ${money(proposed_price)} for "${job.title}".`,
    entityType: 'job',
    entityId:   job.id,
    data: {
      job_id:         job.id,
      job_title:      job.title,
      sender_name:    visibleSenderName,
      round_number,
      proposed_price,
    },
  });
};

const notifyNegotiationAccepted = async ({
  job,
  freelancerUserId,
  clientUserId,
  agreed_price,
  accepted_by,
}) => {
  await notificationService.createBulkNotifications([
    {
      userId:     freelancerUserId,
      type:       'negotiation_accepted',
      title:      'Deal awaiting review',
      body:       `The deal for "${job.title}" was agreed at ${money(agreed_price)}. CREATYV will review it shortly.`,
      entityType: 'job',
      entityId:   job.id,
      data:       { job_id: job.id, job_title: job.title, agreed_price, accepted_by },
    },
    {
      userId:     clientUserId,
      type:       'negotiation_accepted',
      title:      'Deal awaiting review',
      body:       `The deal for "${job.title}" was agreed at ${money(agreed_price)}. CREATYV will review it shortly.`,
      entityType: 'job',
      entityId:   job.id,
      data:       { job_id: job.id, job_title: job.title, agreed_price, accepted_by },
    },
  ]);
};

const notifyNegotiationRejected = async ({
  job,
  freelancerUserId,
  clientUserId,
  rejected_by,
  fallback,
}) => {
  const body = `The negotiation for "${job.title}" has ended.`;

  await notificationService.createBulkNotifications([
    {
      userId:     freelancerUserId,
      type:       'negotiation_rejected',
      title:      'Negotiation ended',
      body,
      entityType: 'job',
      entityId:   job.id,
      data:       { job_id: job.id, job_title: job.title, rejected_by },
    },
    {
      userId:     clientUserId,
      type:       'negotiation_rejected',
      title:      'Negotiation ended',
      body,
      entityType: 'job',
      entityId:   job.id,
      data:       { job_id: job.id, job_title: job.title, rejected_by },
    },
  ]);
};

const notifyAdminDealPending = async ({ job, agreedPrice, agreedDays }) => {
  const adminIds = await getActiveAdminIds();
  if (!adminIds.length) return;

  const notifications = adminIds.map((userId) => ({
    userId,
    type:       'deal_pending_admin',
    title:      'Deal awaiting approval',
    body:       `A deal for "${job.title}" was agreed at ${money(agreedPrice)}${agreedDays ? ` in ${agreedDays} days` : ''}.`,
    entityType: 'job',
    entityId:   job.id,
    data:       { job_id: job.id, job_title: job.title, agreed_price: agreedPrice, agreed_days: agreedDays },
  }));

  await notificationService.createBulkNotifications(notifications);
};

const notifyDealApproved = async ({ job, freelancerUserId, clientUserId, agreedPrice }) => {
  await notificationService.createBulkNotifications([
    {
      userId:     freelancerUserId,
      type:       'deal_approved',
      title:      'Deal approved',
      body:       `Your deal for "${job.title}" has been approved at ${money(agreedPrice)}. Accept the assignment to get started.`,
      entityType: 'job',
      entityId:   job.id,
      data:       { job_id: job.id, job_title: job.title, agreed_price: agreedPrice },
    },
    {
      userId:     clientUserId,
      type:       'deal_approved',
      title:      'Deal approved',
      body:       `The deal for "${job.title}" has been approved at ${money(agreedPrice)}.`,
      entityType: 'job',
      entityId:   job.id,
      data:       { job_id: job.id, job_title: job.title, agreed_price: agreedPrice },
    },
  ]);
};

const notifyDealRejectedByAdmin = async ({
  job,
  freelancerUserId,
  clientUserId,
  adminNote,
  fallback,
}) => {
  const body = `The deal for "${job.title}" was not approved.${adminNote ? ` Note: ${adminNote}` : ''}`;

  await notificationService.createBulkNotifications([
    {
      userId:     freelancerUserId,
      type:       'deal_rejected_by_admin',
      title:      'Deal not approved',
      body,
      entityType: 'job',
      entityId:   job.id,
      data:       { job_id: job.id, job_title: job.title, admin_note: adminNote },
    },
    {
      userId:     clientUserId,
      type:       'deal_rejected_by_admin',
      title:      'Deal not approved',
      body,
      entityType: 'job',
      entityId:   job.id,
      data:       { job_id: job.id, job_title: job.title, admin_note: adminNote },
    },
  ]);
};

const notifyAssignmentCreated = async ({ job, freelancerUserId, agreedPrice }) => {
  await notificationService.createNotification({
    userId:     freelancerUserId,
    type:       'assignment_created',
    title:      'Assignment ready',
    body:       `Your assignment for "${job.title}" is ready at ${money(agreedPrice)}. Accept or decline from your dashboard.`,
    entityType: 'job',
    entityId:   job.id,
    data:       { job_id: job.id, job_title: job.title, agreed_price: agreedPrice },
  });
};

const notifyAssignmentAccepted = async ({ job, freelancerName, clientUserId }) => {
  const adminIds = await getActiveAdminIds();

  const recipientNotifications = [
    {
      userId:     clientUserId,
      type:       'assignment_accepted',
      title:      'Work has started',
      body:       `Your CREATYV creative accepted the assignment for "${job.title}".`,
      entityType: 'job',
      entityId:   job.id,
      data:       { job_id: job.id, job_title: job.title },
    },
    ...adminIds.map((userId) => ({
      userId,
      type:       'assignment_accepted',
      title:      'Assignment accepted',
      body:       `"${job.title}" is now in progress.`,
      entityType: 'job',
      entityId:   job.id,
      data:       { job_id: job.id, job_title: job.title },
    })),
  ];

  await notificationService.createBulkNotifications(recipientNotifications);
};

const notifyAssignmentDeclined = async ({
  job,
  freelancerName,
  clientUserId,
  fallback,
}) => {
  const adminIds = await getActiveAdminIds();

  const recipientNotifications = [
    {
      userId:     clientUserId,
      type:       'assignment_declined',
      title:      'Assignment declined',
      body:       `The creative assigned to "${job.title}" is no longer available. CREATYV is reviewing the project.`,
      entityType: 'job',
      entityId:   job.id,
      data:       { job_id: job.id, job_title: job.title },
    },
    ...adminIds.map((userId) => ({
      userId,
      type:       'assignment_declined',
      title:      'Assignment declined',
      body:       `"${job.title}" needs review.`,
      entityType: 'job',
      entityId:   job.id,
      data:       { job_id: job.id, job_title: job.title, fallback },
    })),
  ];

  await notificationService.createBulkNotifications(recipientNotifications);
};

const notifyKycReviewed = async ({ userId, level, status, adminNote }) => {
  const approved = status === 'approved';
  const label = level.charAt(0).toUpperCase() + level.slice(1);

  await notificationService.createNotification({
    userId,
    type:       approved ? 'kyc_approved' : 'kyc_rejected',
    title:      approved ? `KYC ${label} approved` : `KYC ${label} rejected`,
    body:       approved
      ? `Your ${level} KYC has been approved.`
      : `Your ${level} KYC was rejected.${adminNote ? ` Note: ${adminNote}` : ' Please resubmit with the correct documents.'}`,
    entityType: 'kyc',
    entityId:   null,
    data:       { level, status, admin_note: adminNote },
  });
};

module.exports = {
  notifyMatchedCandidates,
  notifyPromotedPrimary,
  notifyNegotiationInitiated,
  notifyNegotiationCountered,
  notifyNegotiationAccepted,
  notifyNegotiationRejected,
  notifyAdminDealPending,
  notifyDealApproved,
  notifyDealRejectedByAdmin,
  notifyAssignmentCreated,
  notifyAssignmentAccepted,
  notifyAssignmentDeclined,
  notifyKycReviewed,
};
