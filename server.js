'use strict'
const connect = require('connect')
const http = require('http')
const serveStatic = require('serve-static')
const WebSocket = require('ws')

const app = connect()
app.use(serveStatic('./public'))

const server = http.createServer(app)
const wss = new WebSocket.Server({ server })

const tiles = []
const screen = {width: 720, height: 720}

var lastPlayerId = 0

const colors = [
    {dark: 0x12AA12, light: 0x12FF12},
    {dark: 0xAA1212, light: 0xFF1212}
]

for (let j = 0; j < 21; j++) {
    for (let i = 0; i < 21; i++) {
        const tile = {}
        tile.x = screen.width / 2 - 320 + i * 32
        tile.y = screen.height / 2 - 320 + j * 32
        if (i === 10 && j === 10) {
            tile.tint = 0x12AAAA
            tile.isCenter = true
        }
        tiles.push(tile)
    }
}

function generateToken() {
    const c = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const token = [...Array(48)].map(_ => c[~~(Math.random()*c.length)]).join('')
    return token
}

var players = []

function generatePlayer(ws) {
    const token = generateToken()
    const player = {}
    player.id = lastPlayerId
    lastPlayerId++
    player.token = token
    player.currentTile = tiles.find(t => t.isCenter)
    player.currentDirection = 'down'
    player.newDirection = 'down'
    player.directionChangeable = false
    player.passedCenter = false
    player.x = screen.width / 2
    player.y = screen.height / 2
    player.ws = ws
    players.push(player)
    return player
}

function checkIfDirectionValid(direction) {
    if (direction === 'right') {return true}
    if (direction === 'left') {return true}
    if (direction === 'up') {return true}
    if (direction === 'down') {return true}
    return false
}

function setNewDirection(token, direction) {
    const player = players.find(p => p.token === token)
    if (!player) {
        return
    }
    if (!checkIfDirectionValid(direction)) {
        return
    }
    if (player.currentDirection === 'up') {
        if (direction !== 'down') {
            player.newDirection = direction
        }
    }
    if (player.currentDirection === 'down') {
        if (direction !== 'up') {
            player.newDirection = direction
        }
    }
    if (player.currentDirection === 'right') {
        if (direction !== 'left') {
            player.newDirection = direction
        }
    }
    if (player.currentDirection === 'left') {
        if (direction !== 'right') {
            player.newDirection = direction
        }
    }
}

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        parsed = JSON.parse(message)
        if (parsed.type === 'move') {
            setNewDirection(parsed.token, parsed.data)
        }
    })
    const player = generatePlayer(ws)
    const token = player.token
    ws.send(JSON.stringify({type: 'token', data: {token: token, id: player.id}}))
})

function sendUpdate() {
    const playersData = []
    players.forEach(p => {playersData.push({x: p.x, y: p.y, currentDirection: p.currentDirection, id: p.id})})
    const data = {
        type: 'update',
        data: {
            tiles: tiles,
            players: playersData
        }
    }
    const stringifiedData = JSON.stringify(data)
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(stringifiedData)
        }
    })
}
const port = process.env.PORT || 3000
server.listen(port, () => console.log(`Server running on ${port}...`))

let speed = .1

function getNewTile(player) {
    for (let i = 0; i < tiles.length; i++) {
        if (player.x < tiles[i].x - 16) {
            continue
        }
        if (player.x > tiles[i].x + 16) {
            continue
        }
        if (player.y < tiles[i].y - 16) {
            continue
        }
        if (player.y > tiles[i].y + 16) {
            continue
        }
        return tiles[i]
    }
}

function removePlayer(player) {
    newPlayers = players.filter(p => p !== player)
    players = newPlayers
}

var cTime = Date.now()
function gameLoop() {
    const newTime = Date.now()
    const elapsedMS = newTime - cTime
    cTime = newTime
    const distance = speed * elapsedMS
    for (let i = 0; i < players.length; i++) {
        const player = players[i]
        player.passedCenter = false
        if (player.currentDirection === 'up' && player.y > 0) {
            player.y -= distance
            player.passedCenter = player.y < player.currentTile.y
        }
        else if (player.currentDirection === 'down' && player.y < screen.height) {
            player.y += distance
            player.passedCenter = player.y > player.currentTile.y
        }
        else if (player.currentDirection === 'right' && player.x < screen.width) {
            player.x += distance
            player.passedCenter = player.x > player.currentTile.x
        }
        else if (player.currentDirection === 'left' && player.x > 0) {
            player.x -= distance
            player.passedCenter = player.x < player.currentTile.x
        }
        if (player.passedCenter) {
            if (player.currentDirection !== player.newDirection && player.directionChangeable) {
                player.y = player.currentTile.y
                player.x = player.currentTile.x
                player.currentDirection = player.newDirection
            }
            player.currentTile.tint = colors[player.id % 2].dark
            player.passedCenter = false
            player.directionChangeable = false
        }
        const newTile = getNewTile(player)
        if (newTile !== player.currentTile) {
            if (newTile) {
                player.currentTile = newTile
                player.currentTile.tint = colors[player.id % 2].light
                player.directionChangeable = true
            }
            else {
                removePlayer(player)
            }
        }
    }
    sendUpdate()
}

setInterval(gameLoop, 1000/60)
