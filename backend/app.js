const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('MONGODB_URI is not set. Add it in backend/.env');
    process.exit(1);
}

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000' }));
app.use(express.json());

const todoSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        completed: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: true },
        versionKey: false,
    },
);

todoSchema.set('toJSON', {
    transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        ret.createdAt = ret.createdAt?.toISOString?.() || ret.createdAt;
        delete ret._id;
        delete ret.updatedAt;
        return ret;
    },
});

const Todo = mongoose.model('Todo', todoSchema);

app.get('/api/health', (req, res) => {
    res.json({ ok: true });
});

app.get('/api/todos', async (req, res) => {
    try {
        const todos = await Todo.find().sort({ createdAt: -1 });
        res.json(todos);
    } catch (error) {
        console.error('Failed to fetch todos:', error);
        res.status(500).json({ message: 'Failed to fetch todos.' });
    }
});

app.post('/api/todos', async (req, res) => {
    const { title } = req.body;

    if (!title || !title.trim()) {
        return res.status(400).json({ message: 'Title is required.' });
    }

    try {
        const todo = await Todo.create({ title: title.trim() });
        res.status(201).json(todo);
    } catch (error) {
        console.error('Failed to create todo:', error);
        res.status(500).json({ message: 'Failed to create todo.' });
    }
});

app.put('/api/todos/:id', async (req, res) => {
    const { id } = req.params;
    const { title, completed } = req.body;

    if (typeof title !== 'undefined' && (typeof title !== 'string' || !title.trim())) {
        return res.status(400).json({ message: 'Title must be a non-empty string when provided.' });
    }

    if (typeof completed !== 'undefined' && typeof completed !== 'boolean') {
        return res.status(400).json({ message: 'Completed must be a boolean when provided.' });
    }

    const updatePayload = {};
    if (typeof title === 'string') updatePayload.title = title.trim();
    if (typeof completed === 'boolean') updatePayload.completed = completed;

    try {
        const updatedTodo = await Todo.findByIdAndUpdate(id, updatePayload, { new: true, runValidators: true });

        if (!updatedTodo) {
            return res.status(404).json({ message: 'Todo not found.' });
        }

        res.json(updatedTodo);
    } catch (error) {
        if (error instanceof mongoose.Error.CastError) {
            return res.status(404).json({ message: 'Todo not found.' });
        }

        console.error('Failed to update todo:', error);
        res.status(500).json({ message: 'Failed to update todo.' });
    }
});

app.delete('/api/todos/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const deletedTodo = await Todo.findByIdAndDelete(id);

        if (!deletedTodo) {
            return res.status(404).json({ message: 'Todo not found.' });
        }

        res.status(204).send();
    } catch (error) {
        if (error instanceof mongoose.Error.CastError) {
            return res.status(404).json({ message: 'Todo not found.' });
        }

        console.error('Failed to delete todo:', error);
        res.status(500).json({ message: 'Failed to delete todo.' });
    }
});

async function startServer() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to connect to MongoDB:', error);
        process.exit(1);
    }
}

startServer();
