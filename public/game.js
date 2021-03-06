'use strict'
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
var socket = new WebSocket(`${protocol}//${window.location.host}`)
var token = null
var playerId = null
var connected = false

const tiles = []
var players = []

socket.addEventListener('message', function (event) {
    const parsed = JSON.parse(event.data)
    if (parsed.type === 'token') {
        token = parsed.data.token
        playerId = parsed.data.id
    }
    else if (parsed.type === 'update') {
        for (let i = 0; i < parsed.data.tiles.length; i++) {
            const newTint = parsed.data.tiles[i].tint
            if (newTint) {
                tiles[parsed.data.tiles[i].id].tint = newTint
            }
        }
        const foundPlayers = []
        for (let i = 0; i < parsed.data.players.length; i++) {
            let player = players.find(p => p.id === parsed.data.players[i].id)
            if (!player) {
                player = PIXI.Sprite.from('./player.png')
                player.anchor.set(0.5)
                player.x = parsed.data.players[i].x
                player.y = parsed.data.players[i].y
                player.id = parsed.data.players[i].id
                players.push(player)
                app.stage.addChild(player)
            }
            else {
                player.x = parsed.data.players[i].x
                player.y = parsed.data.players[i].y
            }
            if (player.id !== playerId) {
                player.tint = 0x515151
            }
            foundPlayers.push(player)
        }
        const wrongPlayers = players.filter(p => !(foundPlayers.includes(p)))
        wrongPlayers.forEach(p => {p.destroy()})
        const newPlayers = players.filter(p => foundPlayers.includes(p))
        players = newPlayers
    }
})
socket.addEventListener('open', function () {
    connected = true
})
socket.addEventListener('close', function () {
    connected = false
})

const app = new PIXI.Application({width: 720, height: 920, backgroundColor: 0xFFFFFF})
document.getElementById('holder').appendChild(app.view)

function useKey(e) {
    if (!connected) {
        return
    }
    if (typeof e.preventDefault === 'undefined') {
        e.preventDefault = function(){}
    }
    if (e.key === 'ArrowDown') {
        e.preventDefault()
        socket.send(JSON.stringify({type: 'move', token: token, data: 'down'}))
    }
    else if (e.key === 'ArrowUp') {
        e.preventDefault()
        socket.send(JSON.stringify({type: 'move', token: token, data: 'up'}))
    }
    else if (e.key === 'ArrowRight') {
        e.preventDefault()
        socket.send(JSON.stringify({type: 'move', token: token, data: 'right'}))
    }
    else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        socket.send(JSON.stringify({type: 'move', token: token, data: 'left'}))
    }
}

document.addEventListener('keydown', useKey, false)

const gameScreen = {width: 720, height: 720}

var lastTile = 0
for (let j = 0; j < 21; j++) {
    for (let i = 0; i < 21; i++) {
        const tile = PIXI.Sprite.from('./mapTile.png')
        tile.anchor.set(0.5)
        tile.id = lastTile++
        tile.x = gameScreen.width / 2 - 320 + i * 32
        tile.y = gameScreen.height / 2 - 320 + j * 32
        if (i === 10 && j === 10) {
            tile.tint = 0x12AA12
        }
        tiles.push(tile)
        app.stage.addChild(tile)
    }
}

const buttons = [
    {
        img: './buttonLeft.png',
        x: app.screen.width / 2 - 112,
        y: app.screen.height - 110,
        fn: () => {useKey({key: 'ArrowLeft'})}
    },
    {
        img: './buttonRight.png',
        x: app.screen.width / 2 + 112,
        y: app.screen.height - 110,
        fn: () => {useKey({key: 'ArrowRight'})}
    },
    {
        img: './buttonUp.png',
        x: app.screen.width / 2,
        y: app.screen.height - 166,
        fn: () => {useKey({key: 'ArrowUp'})}
    },
    {
        img: './buttonDown.png',
        x: app.screen.width / 2,
        y: app.screen.height - 54,
        fn: () => {useKey({key: 'ArrowDown'})}
    },
]

buttons.forEach(b => {
    const button = PIXI.Sprite.from(b.img)
    button.anchor.set(0.5)
    button.x = b.x
    button.y = b.y
    button.interactive = true
    button.buttonMode = true
    button.on('pointerdown', b.fn)
    app.stage.addChild(button)
})
