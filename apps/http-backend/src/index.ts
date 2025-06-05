import 'dotenv/config'
import express from "express"
import cors from "cors"
import router from './routes'
const port = process.env.PORT!
const app = express()
const corsOptions = {
    
    methods: ['GET', 'POST', 'PUT', 'PATCH', ],
  
  };
app.use(cors(corsOptions))
app.use(express.json())
app.use('/api/v1',router)
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})