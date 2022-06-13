FROM mysql:8

WORKDIR /usr/src/db

COPY ./data/lush_db_data.sql /docker-entrypoint-initdb.d

VOLUME [ "/db/data" ]