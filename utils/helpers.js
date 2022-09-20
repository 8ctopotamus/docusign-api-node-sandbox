const createTabs = (signers, contentHtml) => {
  const placeholders = contentHtml.match(/(?<=\[\[)(.*?)(?=\]\])/g)
  if (!placeholders || placeholders.length === 0) 
    return false
  const tabs = {}
  signers.forEach(({ recipientId }) => {
    tabs[recipientId] = placeholders
      .map(p => {
        const [ type, role, id ] = p.split('_')
        return { type, role, id }
      })
      .reduce((prev, curr) => {
        const { type, role, id } = curr
        const key = `${type}Tabs`
        if(!prev[key] && id === recipientId) {
          prev[key] = [
            {
              recipientId,
              "anchorString": `[[${[ type, role, id ].join('_')}]]`,
              "anchorXOffset": "0",
              "anchorYOffset": "0",
              "anchorIgnoreIfNotPresent": "false",
              "anchorUnits": "pixels",
              "documentId": "2"
            }
          ]
        }
        return prev
      } , {})
  })
  return tabs
}

module.exports = { createTabs }