const router = require('express').Router()
const { authPrompt, authCallback, signout, createEnvelope } = require('../controllers/docusign')

router.get('/signin', authPrompt)
router.get('/signout', signout)
router.get('/authorization-code/callback', authCallback)
router.get('/createEnvelope', createEnvelope)

module.exports = router