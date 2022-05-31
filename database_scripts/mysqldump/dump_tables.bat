@echo off

echo Dumping tables...
set targetDir=%~1
mysqldump lush --ignore-table=lush.audio_blob --no-create-info > "%targetDir%\lush_dump_data_except_audio_blob.sql"
echo Tables have been dumped.

exit