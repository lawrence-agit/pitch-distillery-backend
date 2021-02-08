var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var UserSchema = new Schema({
    firstName: String,
    lastName: String,
    email: String,
    sharedLists: [{type: mongoose.Schema.ObjectId, ref: 'SharedList'}]
},{
    toObject: { getters: true, virtuals: true },
    toJSON: { getters: true, virtuals: true }
});

mongoose.model('User', UserSchema);
exports.UserSchema = UserSchema;
