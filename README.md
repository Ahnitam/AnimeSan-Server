# AnimeSan

## Server para download de midias buscando do banco de dados firebase e movendo automaticamente para um serviço de armazenamento em nuvem

## **Variáveis de Ambiente**

### Variaveis a serem utilizadas para iniciar o server

| **Variável**          | **Descrição**                                | **Obrigatório?**   |
| --------------------- | -------------------------------------------- | ------------------ |
| FIREBASE_PROJECT_ID   | Configurar Firebase                          | **&#10003;**       |
| FIREBASE_PRIVATE_KEY  | Configurar Firebase                          | **&#10003;**       |
| FIREBASE_CLIENT_EMAIL | Configurar Firebase                          | **&#10003;**       |
| FFMPEG_DIR            | Diretorio do FFmpeg                          | **&#10003;**       |
| MKVMERGE_DIR          | Diretorio do mkvmerge                        | **&#10003;**       |
| RCLONE_DIR            | Diretorio do rclone                          | **&#10003;**       |
| RCLONE_CONFIG_DIR     | Diretorio do arquivo de configuração (Rclone)| **&#10003;**       |
| RCLONE_DRIVE          | Nome do drive no rclone                      | **&#10003;**       |
| DIR_DOWNLOAD          | Diretorio de download temporário             | **&#10007;**       |
| DIR_COMPLETO          | Diretorio de download concluido temporário   | **&#10007;**       |
