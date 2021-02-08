var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var SharedListSchema = new Schema({
    name: String,
    emails: [String],
    entities: [Schema.Types.Mixed],
    createdByEmail: String,
    createdByName: String,
    created: {
        type: Date,
        default: Date.now
    },
    changed: {
        type: Date,
        default: Date.now
    }
},{
    toObject: { getters: true, virtuals: true },
    toJSON: { getters: true, virtuals: true }
});

mongoose.model('SharedList', SharedListSchema);
exports.SharedListSchema = SharedListSchema;
