const express = require('express')
const router = new express.Router()
const sharp = require('sharp')
const User = require('../models/user')
const { sendWelcomeEmail, sendCancellationEmail } = require('../emails/account')
const auth = require('../middleware/auth')


const multer = require('multer')
const upload = multer({

    limits: {
        fileSize: 1000000
    },
    fileFilter(req, file, cb) {
        if (!file.originalname.match(/\.(jpeg|jpg|png)$/)) {
            return cb(new Error('upload only jpeg, jpg or png'))
        }
        cb(undefined, true)
    }
})

router.post('/users/me/avatar', auth, upload.single('avatar'), async (req, res) => {
    const buffer = await sharp(req.file.buffer).resize({width: 250, height: 250}).png().toBuffer()
    req.user.avatar = buffer
    await req.user.save()
    res.send()
}, (error, req, res, next) => {
    res.status(400).send({ error: error.message })
})

router.delete('/users/me/avatar', auth, async (req, res) => {
    try {
        req.user.avatar = undefined
        await req.user.save()
        res.send()
    } catch (e) {
        res.send(e)
    }
})

router.get('/users/:id/avatar', async (req, res) => {
    try{
           user = await User.findById(req.params.id)
           if(!user || !user.avatar){
               throw new Error()
           }
           res.set('Content-Type', 'image/png')
           res.send(user.avatar)
    }catch(e){
       res.status(400).send()
    }
})

router.post('/users', async (req, res) => {
    const user = new User(req.body)
    try {

        await user.save()
        sendWelcomeEmail(user.Email, user.name)
        const token = await user.generateAuthToken()
        res.status(201).send({ user, token })


    } catch (e) {
        res.status(400).send(e)
    }
})

router.post('/users/login', async (req, res) => {
    try {
        const user = await User.findByCredentials(req.body.Email, req.body.Password)
        const token = await user.generateAuthToken()
        res.send({ user, token })
    } catch (e) {
        res.status(400).send(e)
    }

})

router.post('/users/logout', auth, async (req, res) => {
    try {
        req.user.tokens = req.user.tokens.filter((token) => {
            return token.token != req.token
        })
        await req.user.save()
        res.send()
    } catch (e) {
        res.status(500).send(e)

    }
})

router.post('/users/logoutAll', auth, async (req, res) => {
    try {
        req.user.tokens = []
        await req.user.save()
        res.send()

    } catch (e) {
        res.status(500).send(e)
    }

})

router.get('/users/me', auth, async (req, res) => {
    res.send(req.user)

})

router.patch('/users/me', auth, async (req, res) => {

    const updates = Object.keys(req.body)
    const allowedUpdates = ['name', 'age', 'Email', 'Password']
    const isvalid = updates.every((update) => allowedUpdates.includes(update))
    if (!isvalid) {
        res.status(400).send('invalid updates!!')
    }
    try {

        updates.forEach((update) => req.user[update] = req.body[update])
        await req.user.save()
        //const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })

        res.send(req.user)
    } catch (e) {
        res.status(400).send(e)
    }
})


router.delete('/users/me', auth, async (req, res) => {
    try {
        sendCancellationEmail(req.user.Email, req.user.name)
        await req.user.remove()
        res.send(req.user)
    } catch (e) {
        res.status(500).send(e)
    }
}
)

module.exports = router