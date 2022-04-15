@echo off

echo Dumping data for audio_blob table...

set targetDir=%~1
if not defined targetDir set /p targetDir="Directory path: "
if not defined targetDir set targetDir=%cd%\lush_dump
if not exist "%targetDir%" mkdir "%targetDir%"

set /p startIndex="Start index: "
if not defined startIndex set startIndex=1

@REM The step variable indicates a number of entries to write in a single file.
set /p step="Step: "
if not defined step set step=10000

@REM Write number of entries inside the audio_blob table in file.
mysql lush -e "SELECT COUNT(*) FROM audio_blob" --skip-column-names > "%targetDir%\audio_blob_row_count.txt"

set /p audio_blob_row_count=<"%targetDir%\audio_blob_row_count.txt"
echo The audio_blob table has %audio_blob_row_count% entries.
@REM Should uncomment the following line when testing.
set /a audio_blob_row_count=28

setLocal enableDelayedExpansion
for /l %%s in (%startIndex%, %step%, %audio_blob_row_count%) do (
  set /a end=%%s+!step!-1
  if !end! gtr %audio_blob_row_count% set /A end=%audio_blob_row_count%

  @REM Takes a lot of time and memory space to complete the task on the next line. Uncomment the following line only if over 200 GiB of space is available.
  mysqldump lush audio_blob --where="id >= %%s AND id <= !end!" --no-create-info > "%targetDir%\lush_dump_data_table_audio_blob_%%s-!end!.sql"

  echo Data for audio_blob table from row %%s to row !end! has been dumped into file "%targetDir%\lush_dump_data_table_audio_blob_%%s-!end!.sql".
)
del "%targetDir%\audio_blob_row_count.txt"
echo Data for audio_blob table has been dumped.

exit