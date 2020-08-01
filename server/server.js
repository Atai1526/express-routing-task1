import express from 'express'
import path from 'path'
import cors from 'cors'
import bodyParser from 'body-parser'
import sockjs from 'sockjs'
import { renderToStaticNodeStream } from 'react-dom/server'
import React from 'react'
import axios from 'axios'

import cookieParser from 'cookie-parser'
import config from './config'
import Html from '../client/html'

const {readFile,writeFile,unlink}= require("fs").promises

const Root = () => ''

try {
  // eslint-disable-next-line import/no-unresolved
  // ;(async () => {
  //   const items = await import('../dist/assets/js/root.bundle')
  //   console.log(JSON.stringify(items))

  //   Root = (props) => <items.Root {...props} />
  //   console.log(JSON.stringify(items.Root))
  // })()
  console.log(Root)
} catch (ex) {
  console.log(' run yarn build:prod to enable ssr')
}

let connections = []

const port = process.env.PORT || 8090
const server = express()

const middleware = [
  cors(),
  express.static(path.resolve(__dirname, '../dist/assets')),
  bodyParser.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }),
  bodyParser.json({ limit: '50mb', extended: true }),
  cookieParser()
]

middleware.forEach((it) => server.use(it))
const delet=()=>{
  unlink(`${__dirname}/users.json`)
}

const write=(users)=>{
    writeFile(`${__dirname}/users.json`,JSON.stringify(users,1,2),{encoding:'utf8'})
}


const read=()=>{
  return readFile(`${__dirname}/users.json`,{encoding: "utf8"})
      .then(result=>JSON.parse(result))
      .catch(async ()=>{
          const {data:users}= await axios('https://jsonplaceholder.typicode.com/users')
          write(users)
          return users
      })
}

server.get('/api/v1/users', async (req,res) => {
   const users= await read()
  res.json(users)
})


server.post('/api/v1/users', async (req,res) => {

  const users= await read()
  const newUsers={...req.body,id:users[users.length-1].id+1}
  const composeUsers=[...users,newUsers]
  write(composeUsers)
  res.json({status:'sucssesfuly'})
})

server.patch('/api/v1/users/:userId', async (req,res) => {

  const {userId}=req.params
  const users= await read()
  const updated=users.map(el=>el.id===+userId?{...el,...req.body}:el)
  write(updated)
  res.json({status:'sucssesfuly'})
})

server.delete('/api/v1/users/:userId', async (req,res) => {

  const {userId}=req.params
  const users= await read()
  const updated=users.filter(el=>el.id!==+userId)
  write(updated)
  res.json({status:'suc'})
})

server.delete('/api/v1/users', async (req,res) => {
  const users= await delet()
  res.json(users)
})


server.use('/api/', (req, res) => {
  res.status(404)
  res.end()
})

const [htmlStart, htmlEnd] = Html({
  body: 'separator',
  title: 'Boilerplate'
}).split('separator')

server.get('/', (req, res) => {
  const appStream = renderToStaticNodeStream(<Root location={req.url} context={{}} />)
  res.write(htmlStart)
  appStream.pipe(res, { end: false })
  appStream.on('end', () => {
    res.write(htmlEnd)
    res.end()
  })
})

server.get('/*', (req, res) => {
  const initialState = {
    location: req.url
  }

  return res.send(
    Html({
      body: '',
      initialState
    })
  )
})

const app = server.listen(port)

if (config.isSocketsEnabled) {
  const echo = sockjs.createServer()
  echo.on('connection', (conn) => {
    connections.push(conn)
    conn.on('data', async () => {})

    conn.on('close', () => {
      connections = connections.filter((c) => c.readyState !== 3)
    })
  })
  echo.installHandlers(app, { prefix: '/ws' })
}
console.log(`Serving at http://localhost:${port}`)
