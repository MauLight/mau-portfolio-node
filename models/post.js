const mongoose = require('mongoose')
const uniqueValidator = require('mongoose-unique-validator')

const postSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        minlength: 3,
        unique: true
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    img: {
        type: String,
        required: true
    },
    body: {
        type: String,
        required: true
    },
    likes: {
        type: Number,
        default: 0
    },
    tags: [{
        type: String
    }],
})

postSchema.plugin(uniqueValidator)

const Post = mongoose.model('Post', postSchema)

module.exports = Post