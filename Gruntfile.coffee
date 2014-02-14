module.exports = (grunt) ->
	banner = '/*! dostavista_api.js v0.9 | (c) 2014 Dostavista.ru, Oleg Gromov <mail@oleggromov.com> | https://github.com/dostavista/dostavista_api.js */'

	grunt.initConfig 
		uglify:
			production:
				src: 'dostavista_api.js'
				dest: 'build/dostavista_api.min.js'
				options:
					banner: banner

		csso:
			production:
				src: 'dostavista_api.css'
				dest: 'build/dostavista_api.min.css'
				options:
					banner: banner


	grunt.loadNpmTasks 'grunt-contrib-uglify'
	grunt.loadNpmTasks 'grunt-csso'

	grunt.registerTask 'default', ['uglify', 'csso']