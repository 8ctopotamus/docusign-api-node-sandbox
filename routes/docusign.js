const router = require('express').Router()
const { authPrompt, authCallback, signout, createEnvelope, getEmbeddedSiginingURL } = require('../controllers/docusign')

router.get('/signin', authPrompt)
router.get('/authorization-code/callback', authCallback)
router.get('/signout', signout)
router.get('/createEnvelope', createEnvelope)
router.get('/getEmbeddedSigningURL', getEmbeddedSiginingURL)

module.exports = router