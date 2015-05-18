var gulp = require('gulp');
var babel = require('gulp-babel');

gulp.task('default', function () {
    gulp.watch('./src/**', ['build']);
});

gulp.task('build', function(){
    return gulp.src('./src/relay.js')
        .pipe(babel({optional:'runtime'}))
        .pipe(gulp.dest('./'));
});