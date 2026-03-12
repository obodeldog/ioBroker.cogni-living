try {
    require('./lib/main.js');
    console.log('lib/main.js: NO SyntaxError');
} catch(e) {
    if (e instanceof SyntaxError) {
        console.log('lib/main.js: SyntaxError: ' + e.message);
    } else {
        console.log('lib/main.js: Runtime error (expected): ' + e.constructor.name + ': ' + e.message.substring(0,80));
    }
}
