const containerDiv = document.getElementById('signing-ui')

const renderErr = err => {
  containerDiv.innerHTML = `<pre class="error">${JSON.stringify(err)}</pre>`
}

fetch('/docusign/getEmbeddedSigningURL')
  .then(res => res.json())
  .then(json => {
    containerDiv.innerHTML = ''
    if (Array.isArray(json)) {
      json.forEach(url => containerDiv.innerHTML += `
        <iframe src="${url}" width="100%" height="300"></iframe>
      `)
    } else {
      renderErr(json)
    }
  })
  .catch(err => renderErr(err.message))