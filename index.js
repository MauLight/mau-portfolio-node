require('dotenv').config()
const { ApolloServer } = require('@apollo/server')

const { WebSocketServer } = require('ws')
const { useServer } = require('graphql-ws/lib/use/ws')

const { expressMiddleware } = require('@apollo/server/express4')
const { ApolloServerPluginDrainHttpServer } = require('@apollo/server/plugin/drainHttpServer')
const { makeExecutableSchema } = require('@graphql-tools/schema')
const express = require('express')
const cors = require('cors')
const http = require('http')

const resolvers = require('./resolvers/resolvers')

const fs = require('fs')
const path = require('path')
const jwt = require('jsonwebtoken')

const mongoose = require('mongoose')
mongoose.set('strictQuery', false)

const User = require('./models/user')

const MONGODB_URI = process.env.MONGODB_URI
const SECRET = process.env.SECRET
console.log('Connecting to MongoDB!')

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('connected to MongoDB!')
    })
    .catch((error) => {
        console.log('error connecting to MongoDB', error.message)
    })

mongoose.set('debug', true)

const start = async () => {
    const app = express()
    const httpServer = http.createServer(app)

    const wsServer = new WebSocketServer({
        server: httpServer,
        path: '/',
    })

    const schema = makeExecutableSchema({
        typeDefs: fs.readFileSync(
            path.join(__dirname, 'schema.graphql'),
            'utf8'
        ),
        resolvers
    })

    const serverCleanup = useServer({ schema }, wsServer)

    const server = new ApolloServer({
        schema,
        plugins: [
            ApolloServerPluginDrainHttpServer({ httpServer }),
            {
                async serverWillStart() {
                    return {
                        async drainServer() {
                            await serverCleanup.dispose();
                        },
                    };
                },
            },
        ],
    })

    await server.start()

    app.use(
        '/',
        cors(),
        express.json(),
        expressMiddleware(server, {
            context: async ({ req }) => {
                const auth = req ? req.headers.authorization : null
                if (auth && auth.startsWith('Bearer ')) {
                    const decodedToken = jwt.verify(auth.substring(7), process.env.SECRET)
                    const currentUser = await User.findById(decodedToken.id).populate(
                        'friends', 'posts'
                    )
                    console.log(currentUser)
                    return { currentUser }
                }
            },
        }),
    )

    const PORT = 4000
    httpServer.listen(PORT, () => {
        console.log(`Server is now running at http://localhost:${PORT}`)
    })

}

start()