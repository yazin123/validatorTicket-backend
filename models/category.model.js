// models/event.model.js
const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please add a title'],
        trim: true,
        unique: true,
        maxlength: [100, 'Title cannot be more than 100 characters']
    },


}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});


module.exports = mongoose.model('Category', categorySchema);

