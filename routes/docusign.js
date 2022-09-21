const router = require('express').Router()
const { authPrompt, authCallback, signout, createEnvelope, getEmbeddedSiginingURL } = require('../controllers/docusign')

router.get('/signin', authPrompt)
router.get('/signout', signout)
router.get('/authorization-code/callback', authCallback)
router.get('/createEnvelope', createEnvelope)
router.get('/getEmbeddedSigningURL', getEmbeddedSiginingURL)

module.exports = router