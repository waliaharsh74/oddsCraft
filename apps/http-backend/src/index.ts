import "dotenv/config"
import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import router from "./routes"
import { corsOptions } from "./config/env"
import { logger } from "./lib/logger"
import { errorHandler, notFoundHandler } from "./middlewares/error"

const port = process.env.PORT || 3000
const app = express()

app.set("trust proxy", 1)
app.use(cookieParser())
app.use(cors(corsOptions))
app.use(express.json())
app.use((req, _res, next) => {
    logger.info({ method: req.method, path: req.originalUrl, ip: req.ip }, "Incoming request")
    next()
})

app.use("/api/v1", router)
app.use(notFoundHandler)
app.use(errorHandler)

app.listen(port, () => {
    logger.info({ port }, "Server is running")
})
