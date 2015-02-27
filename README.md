# Oil Climate Index

## Development environment
To set up the development environment for this website, you'll need to install the following on your system:

- [Node and npm](http://nodejs.org/)
- Ruby and [Bundler](http://bundler.io/), preferably through something like [rvm](https://rvm.io/)
- Grunt ( $ npm install -g grunt-cli )
- Bower ( $ npm install -g bower )

After these basic requirements are met, run the following commands in the website's folder:
```
$ npm install

```

### Commands

Spins up a webserver to serve the website.
```
$ grunt serve
```

Compile the sass files and javascripts. Use this instead of ```grunt``` if you just want to render it once:
```
$ grunt build
```

```
$ grunt
```

### Deployment
Running `grunt build` will build the site and put all the assets into a `dist` directory. That directory can be served statically from any server. 
