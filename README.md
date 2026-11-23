# Hamaralabs chat

- A chat app for my makerspace incharge
- He uses it to chat with the students, and mentors visiting the lab

## Features

- Create rooms
- Invite users
- Send messages
  - Latex support
  - Audio and file uploads
  - Table support
  - Code block support
- Works real time
- Pretty responsive design

## Integrations -

- Connected authentik
- Used NextAuth
- CI/CD using github actions. A human trigger in the actions tab of github automatically - builds docker file, checks for errors and deploys it in the github registry, please check the [actions.yml file](.github/workflows/docker-build.yml).
  - Github registry link - <https://github.com/vmss2009/hamaralabs-chat/pkgs/container/hamaralabs-chats>
- **Imp** - Self hosted, used docker to containerise everything aforementioned, making it very secured

## Want to run this by yourself ?

- Setup authentik (follow <https://docs.goauthentik.io/install-config/>)
  - Add an application, then a provider, and update the `.env` with those credentials using `env.example` as base
- Setup Minio Db, add the bucket "chat" and change the ACL rules to public read and private write
- Install docker engine
- Use the docker compose file (`docker-compose.yml`) and start the container
- According to your set hosting configuration (either nginx serving over the internet or home network or locally in your computer) access your calendar !!!!!
