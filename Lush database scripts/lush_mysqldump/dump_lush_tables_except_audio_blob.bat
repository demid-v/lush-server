@echo off

echo Dumping data for all tables except audio_blob...
set targetDir=%~1
mysqldump lush --ignore-table=lush.audio_blob --no-create-info > "%targetDir%\lush_dump_data_except_audio_blob.sql"
echo Data for all tables except audio_blob have been dumped.

exit