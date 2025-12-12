import "dotenv/config"
import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import router, { hydrateBooksFromDb } from "./routes"
import { corsOptions } from "./config/env"
import { logger } from "./lib/logger"
import { errorHandler, notFoundHandler } from "./middlewares/error"
import { pinoHttp } from "pino-http"

const port = process.env.PORT || 3000
const app = express()

app.set("trust proxy", 1)
app.use(pinoHttp({ logger }))

app.use(cors(corsOptions))
app.use(cookieParser())
app.use(express.json())

app.use("/api/v1", router)
app.use(notFoundHandler)
app.use(errorHandler)

async function bootstrap() {
    await hydrateBooksFromDb()
    app.listen(port, () => {
        logger.info({ port }, "Server is running")
    })
}

bootstrap().catch((err) => {
    logger.error({ err }, "Failed to bootstrap service")
    process.exit(1)
})
