const chatService = require('./chat.service');
const { sendSuccess } = require('../../utils/apiResponse');
const AppError = require('../../utils/AppError');

const getMyRooms = async (req, res, next) => {
  try {
    const rooms = await chatService.getMyRooms(req.user.sub, req.user.role);
    return sendSuccess(res, { data: { rooms } });
  } catch (err) { next(err); }
};

const getRoom = async (req, res, next) => {
  try {
    const room = await chatService.getRoomById(
      req.params.roomId,
      req.user.sub,
      req.user.role
    );
    return sendSuccess(res, { data: { room } });
  } catch (err) { next(err); }
};

const getMessages = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await chatService.getMessages(
      req.params.roomId,
      req.user.sub,
      req.user.role,
      {
        page:  parseInt(page, 10)  || 1,
        limit: parseInt(limit, 10) || 50,
      }
    );
    return sendSuccess(res, { data: result });
  } catch (err) { next(err); }
};

const sendMessage = async (req, res, next) => {
  try {
    const { content, attachment_url, attachment_type } = req.body;
    const message = await chatService.sendMessage(
      req.params.roomId,
      req.user.sub,
      req.user.role,
      { content, attachment_url, attachment_type }
    );
    return sendSuccess(res, {
      data:       { message },
      message:    'Message sent',
      statusCode: 201,
    });
  } catch (err) { next(err); }
};

const editMessage = async (req, res, next) => {
  try {
    const message = await chatService.editMessage(req.params.messageId, req.user.sub, req.user.role, { content: req.body.content });
    return sendSuccess(res, { data: { message }, message: 'Message edited' });
  } catch (err) { next(err); }
};

const markDelivered = async (req, res, next) => {
  try {
    const delivered = await chatService.markDelivered(req.user.sub, req.user.role);
    return sendSuccess(res, { data: { delivered } });
  } catch (err) { next(err); }
};

const setOnline = async (req, res, next) => {
  try {
    await chatService.setOnline(req.user.sub);
    return sendSuccess(res, { message: 'Presence updated' });
  } catch (err) { next(err); }
};

const setOffline = async (req, res, next) => {
  try {
    await chatService.setOffline(req.user.sub);
    return sendSuccess(res, { message: 'Offline status set' });
  } catch (err) { next(err); }
};

const getPresence = async (req, res, next) => {
  try {
    const presence = await chatService.getPresence(req.params.userId);
    return sendSuccess(res, { data: { presence } });
  } catch (err) { next(err); }
};

// Admin
const getWhatsAppNumbers = async (req, res, next) => {
  try {
    const numbers = await chatService.getWhatsAppNumbers();
    return sendSuccess(res, { data: { numbers } });
  } catch (err) { next(err); }
};

const upsertWhatsAppNumber = async (req, res, next) => {
  try {
    const { category_id, display_name, phone_number, waba_phone_id } = req.body;
    if (!display_name || !phone_number || !waba_phone_id) {
      throw new AppError('display_name, phone_number, and waba_phone_id are required', 400);
    }
    const number = await chatService.upsertWhatsAppNumber({
      categoryId:  category_id,
      displayName: display_name,
      phoneNumber: phone_number,
      wabaPhoneId: waba_phone_id,
    });
    return sendSuccess(res, {
      data:       { number },
      message:    'WhatsApp number saved',
      statusCode: 201,
    });
  } catch (err) { next(err); }
};

module.exports = {
  getMyRooms,
  getRoom,
  getMessages,
  sendMessage,
  editMessage,
  markDelivered,
  setOnline,
  setOffline,
  getPresence,
  getWhatsAppNumbers,
  upsertWhatsAppNumber,
};