import mongoose from 'mongoose';
import Grid from 'gridfs-stream';
import fs from 'fs';

import UserModel from '../models/user.js';
import {ContentEntryModel} from '../models/contentEntry.js';
import TimelineModel from '../models/timeline.js';

const ObjectId = mongoose.Types.ObjectId;


var gfsBucket;
var gfs;
const conn = mongoose.connection;
conn.once("open", () => {
  gfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
   bucketName: 'photos'
  });
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection('photos');
});

const TimelineController = {
  getTimelineById: async (req) => {
    try {
      var id = req.params === undefined ? req.id : req.params.id;
      if (mongoose.isValidObjectId(id)) {
        const result = await TimelineModel.findById(id);
        return result;
      } else {
        return {statusCode: 400, error: 'Bad Request', message: 'Invalid object ID'};
      }
    } catch (error) {

    }
  },
  getTimelineByUserId: async (req) => {
    try {
      var userId = req.params === undefined ? req.id : req.params.userId;
      if (mongoose.isValidObjectId(userId)) {
        const result = await TimelineModel.find({ userId: userId });
        return result;
      } else {
        return {statusCode: 400, error: 'Bad Request', message: 'Invalid object ID'};
      }
    } catch (error) {
      return new Error(error);
    }
  },
  getTimelines: async () => {
    try {
      return await TimelineModel.find();
    } catch (error) {
      return new Error(error);
    }
  },
  createTimeline: async (req) => {
    try {
      const body = {... req.body};
      const newTimeline = new TimelineModel(body);
      const userExists = await UserModel.findOne({ id: body.userId });

      if (mongoose.isValidObjectId(body.userId) && userExists) {
        return await newTimeline.save();
      } else {
        return {statusCode: 400, error: 'Bad Request', message: 'User not in database or ObjectId is invalid'};
      }

    } catch (error) {
      return new Error(error);
    }
  },
  editTimeline: async (req) => {
    try {
      const id = req.params === undefined ? req.id : req.params.id;
      const body = req.body;
      const found = await TimelineModel.findOne({ id: id });

      if (mongoose.isValidObjectId(id) && found) {
        return await TimelineModel.findByIdAndUpdate(id, body, { new: true });
      } else {
        return {statusCode: 400, error: 'Bad Request', message: 'Timeline object does not exist or ObjectId is invalid'};
      }
    } catch (error) {
      return new Error(error);
    }
  },
  deleteTimeline: async (req) => {
    try {
      const id = req.params === undefined ? req.id : req.params.id;
      const found = await TimelineModel.findOne({ id: id });
      console.log("ID:", id);
      if (mongoose.isValidObjectId(id) && found) {
        return await TimelineModel.findByIdAndRemove(id);
      } else {
        return {statusCode: 400, error: 'Bad Request', message: 'Timeline object does not exist or ObjectId is invalid'};
      }
    } catch (error) {
      return new Error(error);
    }
  },
  addImgToTimeline: async (req) => {
    try {
      const id = req.id;
      console.log("ID: ", id);
      return await TimelineModel.updateOne(
        {id: id}, {image: req.file.filename}
      );
    } catch (error) {
      return new Error(error);
    }
  },
  addEntry: async (req) => {
    try {
      const pinfo = JSON.parse(req.body.postInfo);
      const id = pinfo === undefined ? req.id : pinfo.id;
      const existing = await TimelineModel.findOne({ id: id });

      if (mongoose.isValidObjectId(id) && existing) {
        const eventDate = new Date(pinfo.entry.eventDate);

        const entry = { ... pinfo.entry, eventDate:  eventDate, attachments: req.file !== undefined ? [req.file.filename] : [], timelineId: id };
        const entryModel = new ContentEntryModel(entry);
        await entryModel.save();
        return await TimelineModel.updateOne(
          {id: id}, { $push: {content: entryModel} }
        );
      } else if (mongoose.isValidObjectId(id)) {
        return {statusCode: 400, error: 'Bad Request', message: 'Timeline object ID is incorrect'};
      } else {
        return {statusCode: 400, error: 'Bad Request', message: 'Timeline object does not exist or ObjectId is invalid'};
      }
    } catch (error) {
      return new Error(error);
    }
  },
  editEntry: async (req) => {
    try {
      const id = req.body === undefined ? req.id : req.body.id;
      const entryId = req.body === undefined ? req.eid :
      req.body.eid;
      const existing = await TimelineModel.findOne({ id: id });

      if (mongoose.isValidObjectId(id) && existing) {
        const entry = { ... req.entry };
        const entryModel = new ContentEntryModel(entry);
        return await TimelineModel.findOneAndUpdate(
          {id: id, "content._id": new ObjectId(entryId) },
          { $set: {
            'content.$.title': entry.title,
            'content.$.description': entry.description,
            'content.$.attachments': entry.attachments
          } },
          {new: true}
        );
      } else if (mongoose.isValidObjectId(id)) {
        return {statusCode: 400, error: 'Bad Request', message: 'Timeline object ID is incorrect'};
      } else {
        return {statusCode: 400, error: 'Bad Request', message: 'Timeline object does not exist or ObjectId is invalid'};
      }
    } catch (error) {
      return new Error(error);
    }
  },
  deleteEntry: async (req) => {
    try {
      const id = req.body === undefined ? req.id : req.body.id;
      const entryId = req.body === undefined ? req.eid :
      req.body.eid;
      const existing = await TimelineModel.findOne({ id: id });
      console.log("ID: ", id, "EXISTING: ", existing, "VALID: ", mongoose.isValidObjectId(id));

      if (mongoose.isValidObjectId(id) && existing) {
        await ContentEntryModel.findByIdAndRemove(entryId);
        return await TimelineModel.updateOne(
          {id: id}, { $pull: {content: {_id: entryId}} }
        );
      } else {
        return {statusCode: 400, error: 'Bad Request', message: 'Timeline object does not exist or ObjectId is invalid'};
      }
    } catch (error) {
      return new Error(error);
    }
  },
  viewEntry: async (req) => {
    try {
      const id = req.params === undefined ? req.id : req.params.id;
      const entryId = req.params === undefined ? req.eid :
      req.params.eid;
      // const existing = TimelineModel.findOne({ id: id });
      const isValid = mongoose.isValidObjectId(id) && mongoose.isValidObjectId(entryId);
      if (isValid) {
        const result = await TimelineModel.findOne(
          { id: id }
        )
        .then((field) => {
          return field.content;
        });
        return result.filter(entry => entry._id.toString() === entryId);
      } else {
        return {statusCode: 400, error: 'Bad Request', message: 'Timeline object does not exist or ObjectId is invalid'};
      }
    } catch (error) {
      return new Error(error);
    }
  },
  viewImage: async (req, res) => {
    try {
      const file = await gfs.files.findOne({ filename: req.params.filename });
      var buffer = Buffer.alloc(file.chunkSize);

      // console.log("FILE: ", file);
      const readStream = gfsBucket.openDownloadStream(file._id);
      // console.log("RS: ", readStream);
      const writeStream = fs.createWriteStream('tempimg');

      await readStream.pipe(writeStream)
        .on('finish', () => {
          var result = fs.readFileSync('tempimg');
          res.type(file.contentType);
          res.send(result);
        })
        .on('error', (error) => {
          return new Error(error);
        });
      // return {};
    } catch (error) {
      return new Error(error);
    }
  },

};

export default TimelineController;
