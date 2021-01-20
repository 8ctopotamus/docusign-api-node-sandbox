var system = require("system");
var env = system.env;
var page = require("webpage").create();

page.settings.userAgent =
  "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.94 Safari/537.36";

// default viewport size is small, change it to 1366x768
page.viewportSize = {
  width: 1366,
  height: 768
};

// open page
page.open(env.URL, function(status) {
  if (status == "success") {
    // wait until all the assets are loaded
    function checkReadyState() {
      var readyState = page.evaluate(function() {
        
        return document.readyState;
      });

      if (readyState == "complete") {
        var result = page.evaluate(function() {
          console.log(document.getElementById('sign-here').getBoundingClientRect())

          return document.getElementById('sign-here').scrollTop();
        });

        // exit and return HTML
        system.stdout.write(result);
        phantom.exit(0);
      } else {
        setTimeout(checkReadyState, 50);
      }
    }

    checkReadyState();
  } else {
    // if status is not 'success' exit with an error
    system.stderr.write(error);
    phantom.exit(1);
  }
});