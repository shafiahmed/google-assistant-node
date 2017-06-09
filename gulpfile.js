let gulp = require('gulp');
let clean = require('gulp-clean');
let ts = require('gulp-typescript');

// Directories
let sources = ["ts/**/*"]
let outputDir = 'build';
let tsConfig = 'tsconfig.json';
let tsProject = ts.createProject(tsConfig);

gulp.task('compile', function() {
  gulp.src(sources)
  .pipe(tsProject()).js
  .pipe(gulp.dest(outputDir));
});

gulp.task('watch', function() {
  gulp.watch(sources, ['clean', 'compile']);
})

gulp.task('clean', function() {
  gulp.src(outputDir, {read: false})
    .pipe(clean());
})

gulp.task('default', ['clean', 'compile']);
