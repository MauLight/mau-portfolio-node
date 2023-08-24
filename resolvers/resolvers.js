const { PubSub } = require('graphql-subscriptions')
const pubsub = new PubSub()

const { GraphQLError } = require('graphql')

const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')

const User = require('../models/user')
const Post = require('../models/post')

const resolvers = {
    User: {
        friendOf: async (root) => {
            const friends = await User.find({ friends: { $in: [root._id] } })
            return friends
        }
    },
    Post: {
        author: async (root) => {
            console.log('This is the root', root)
            const user = await User.findOne({ username: root.author.username })
            return user
        }
    },
    Query: {
        me: (root, args, { currentUser }) => {
            console.log('this is the current USER', currentUser)
            return currentUser
        },
        userCount: async () => User.collection.countDocuments(),
        postCount: async () => Post.collection.countDocuments(),
        allUsers: async () => {
            const users = await User.find({}).populate('friends', 'friendOf', 'posts')
            return users
        },
        allPosts: async () => {

            const posts = await Post.find({}).populate('author')
            return posts
        }
    },

    Mutation: {

        createUser: async (root, args) => {
            const saltRounds = 10
            const passwordHash = await bcrypt.hash(args.password, saltRounds)

            const user = new User({ username: args.username, passwordHash: passwordHash })
            try {
                await user.save()
            } catch (error) {
                throw new GraphQLError('Creation of user failed', {
                    extensions: {
                        code: 'BAD_USER_INPUT',
                        invalidArgs: args.name,
                        error
                    }
                })
            }

            pubsub.publish('USER_ADDED', { userAdded: user })
            return user

        },

        login: async (root, args) => {

            const user = await User.findOne({ username: args.username })
            const passwordCorrect = user === null
                ? false
                : await bcrypt.compare(args.password, user.passwordHash)

            if (!user || !passwordCorrect) {
                throw new GraphQLError('wrong credentials', {
                    extensions: {
                        code: 'BAD_USER_INPUT'
                    }
                })
            }

            const userForToken = {
                username: user.username,
                id: user._id
            }

            return {
                value: jwt.sign(
                    userForToken,
                    process.env.SECRET
                )
            }

        },

        addPost: async (root, args, context) => {

            console.log("We're starting.....")
            const currentUser = context.currentUser

            if (!currentUser) {
                throw new GraphQLError('user not authenticated', {
                    extensions: {
                        code: 'BAD_USER_INPUT'
                    }
                })
            }

            const post = new Post({
                title: args.title,
                author: currentUser,
                img: args.img,
                body: args.body,
                likes: args.likes,
                tags: args.tags,
            })

            try {
                await post.save()
            } catch (error) {
                throw new GraphQLError('Saving post failed', {
                    extensions: {
                        code: 'BAD_USER_INPUT',
                        invalidArgs: args.name,
                        error
                    }
                })
            }
            pubsub.publish('POST_ADDED', { postAdded: post })
            return post

        },

        addFriend: async (root, args, { currentUser }) => {

            console.log('We are starting...', currentUser)

            if (!currentUser) {
                throw new GraphQLError('user not authenticated', {
                    extensions: {
                        code: 'BAD_USER_INPUT',
                    }
                })
            }

            const friend = await User.findOne(args.friend)
            const isFriend = currentUser.friends.map(f => f._id.toString().includes(args.friend))

            if (!isFriend) {
                currentUser.friends = currentUser.friends.concat(friend)
            }

            try {
                currentUser.save()
            }
            catch (error) {
                throw new GraphQLError('Saving friend failed', {
                    extensions: {
                        code: 'BAD_USER_INPUT',
                        invalidArgs: args.name,
                        error
                    }
                })
            }

            return friend

        },

        addLikes: async (root, args) => {

            const post = await Post.findOne({ title: args.title }).populate('author')
            console.log(post)
            console.log(args.setLikesto)
            console.log(typeof args.setLikesto)
            post.likes = args.setLikesto

            try {
                await post.save()
            }
            catch (error) {
                throw new GraphQLError('Saving post info failed', {
                    extensions: {
                        code: 'BAD_USER_INPUT',
                        invalidArgs: args.name,
                        error
                    }
                })
            }

            return post

        },

        editBio: async (root, args, { currentUser }) => {

            const user = currentUser
            user.bio = args.bio

            try {
                await user.save()
            }
            catch (error) {
                throw new GraphQLError('Saving user info failed', {
                    extensions: {
                        code: 'BAD_USER_INPUT',
                        invalidArgs: args.name,
                        error
                    }
                })
            }

            return user
        },

        editAvatar: async (root, args, { currentUser }) => {

            const user = currentUser
            user.pic = args.pic

            try {
                await user.save()
            }
            catch (error) {
                throw new GraphQLError('Saving user info failed', {
                    extensions: {
                        code: 'BAD_USER_INPUT',
                        invalidArgs: args.name,
                        error
                    }
                })
            }

            return user
        },

        editWall: async (root, args, { currentUser }) => {

            const user = currentUser
            user.wall = args.wall

            try {
                await user.save()
            }
            catch (error) {
                throw new GraphQLError('Saving user info failed', {
                    extensions: {
                        code: 'BAD_USER_INPUT',
                        invalidArgs: args.name,
                        error
                    }
                })
            }

            return user
        }

    },

    Subscription: {
        userAdded: {
            subscribe: () => pubsub.asyncIterator('USER_ADDED')
        },
        postAdded: {
            subscribe: () => pubsub.asyncIterator('POST_ADDED')
        }
    }
}

module.exports = resolvers