const path = require('path')
const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const Filter = require('bad-words')
const { generateMessage, generateLocationMessage } = require('./utils/messages')
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users')
const { callbackify } = require('util')

const app = express()
const server = http.createServer(app)
const io = socketio(server)

const port = 3000
const publicDirectoryPath = path.join(__dirname, '../public')

app.use(express.static(publicDirectoryPath))

io.on('connection', socket => {
    console.log('new websocket connection')

    socket.on('join', (options, callback) => {
        const { error, user } = addUser({ id: socket.id, ...options })

        if (error) return callback(error)

        socket.join(user.room)

        socket.emit('message', generateMessage('Admin', 'Welcome!'))
        socket.broadcast.to(user.room).emit('message', generateMessage('Admin', `${user.username} has joined!`))
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback()
    })

    socket.on('sendMessage', (message, callback) => {
        const {room, username} = getUser(socket.id)

        const filter = new Filter()

        if (filter.isProfane(message)) {
            return callback('Profanity is not allowed!')
        }

        io.to(room).emit('message', generateMessage(username, message))
        callback()
    })

    socket.on('sendLocation', ({ latitude, longitude }, callback) => {
        const {room, username} = getUser(socket.id)
        io.to(room).emit('locationMessage', generateLocationMessage(username, `https://google.com/maps?q=${latitude},${longitude}`))
        callback()
    })

    socket.on('disconnect', () => {
        const {room, username} = removeUser(socket.id) || {}

        if (room && username) {
            io.to(room).emit('message', generateMessage('Admin', `${username} has left!`))
            io.to(room).emit('roomData', {
                room,
                users: getUsersInRoom(room)
            })
        }
    })
})

server.listen(port, () => {
    console.log(`Listening on port ${port}`)
})