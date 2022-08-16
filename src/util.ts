import { ChildProcessWithoutNullStreams } from "child_process";
import { createWriteStream, existsSync, mkdirSync, unlink } from "fs";
import https from "https";
import "dotenv/config";

const user_agent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36";
const firebase_config = {
	projectId: process.env.FIREBASE_PROJECT_ID!,
	privateKey: process.env.FIREBASE_PRIVATE_KEY!,
	clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
}

const diretorio_download = process.env.DIR_DOWNLOAD!;
const diretorio_completo = process.env.DIR_COMPLETO!;

const diretorio_ffmpeg = process.env.FFMPEG_DIR!;
const diretorio_mkvmerge = process.env.MKVMERGE_DIR!;
const diretorio_rclone = process.env.RCLONE_DIR!;
const diretorio_rclone_config = process.env.RCLONE_CONFIG_DIR!;
const rclone_drive = process.env.RCLONE_DRIVE!;

type StreamProc = { id: string, completo: boolean, peso: number, porcentagem: number, proc: ChildProcessWithoutNullStreams | undefined, arq: string };
type StreamOption = { type: string | null, url: string | null }
type StreamOptions = { dub: StreamOption, leg: StreamOption }
type Stream = { audio: StreamOptions, video: StreamOptions, legenda: StreamOptions };

type Episodio = { id: string, animeName: string, duration: number, episodeId: string, seasonEpisode: string, seasonId: string, stream: string, tipo: string, hardsub: Stream, softsub: Stream };

function toTimeMS(h: string, m: string, s: string): number{
    return Number((Number(h)*3600000) + (Number(m)*60000) + (Number(s.replace("\,", "\."))*1000));
}

function toTime(t: number): string{
    let ms_h = t - (t % 3600000);
    let ms_m = (t - ms_h) - ((t - ms_h) % 60000);
    let ms_s = (t - ms_h - ms_m);
    
    return (ms_h / 3600000).toLocaleString("en-US", {minimumIntegerDigits: 2}) + ":" + (ms_m / 60000).toLocaleString("en-US", {minimumIntegerDigits: 2}) + ":" + (ms_s / 1000).toLocaleString("en-US", {minimumIntegerDigits: 2, minimumFractionDigits: 2, maximumFractionDigits: 3});
}

function verifyNecessaryComponents(){
	let working = true;

	if (rclone_drive === undefined || rclone_drive === ""){
		console.log("O nome do Drive no rclone não foi definido");
		working = false;
	}

	if (diretorio_rclone === undefined || diretorio_rclone === ""){
		console.log("O diretório do rclone não foi definido");
		working = false;
	} else if(!existsSync(diretorio_rclone)){
		console.log("O diretório do rclone não existe");
		working = false;
	}

	if (diretorio_ffmpeg === undefined || diretorio_ffmpeg === ""){
		console.log("O diretório do ffmpeg não foi definido");
		working = false;
	} else if(!existsSync(diretorio_ffmpeg)){
		console.log("O diretório do ffmpeg não existe");
		working = false;
	}

	if (diretorio_mkvmerge === undefined || diretorio_mkvmerge === ""){
		console.log("O diretório do mkvmerge não foi definido");
		working = false;
	} else if(!existsSync(diretorio_mkvmerge)){
		console.log("O diretório do mkvmerge não existe");
		working = false;
	}

	if (diretorio_rclone_config === undefined || diretorio_rclone_config === ""){
		console.log("O diretório do rclone config não foi definido");
		working = false;
	} else if(!existsSync(diretorio_rclone_config)){
		console.log("O diretório do rclone config não existe");
		working = false;
	}

	if (diretorio_download === undefined || diretorio_download === ""){
		console.log("O diretório de download não foi definido");
		working = false;
	}

	if (diretorio_completo === undefined || diretorio_completo === ""){
		console.log("O diretório de download completo não foi definido");
		working = false;
	}

	if (firebase_config.projectId === undefined || firebase_config.projectId === ""){
		console.log("O projectId do firebase não foi definido");
		working = false;
	}

	if (firebase_config.privateKey === undefined || firebase_config.privateKey === ""){
		console.log("O privateKey do firebase não foi definido");
		working = false;
	}

	if (firebase_config.clientEmail === undefined || firebase_config.clientEmail === ""){
		console.log("O clientEmail do firebase não foi definido");
		working = false;
	}

	if (!working){
		process.exit(1);
	}

	createDiretoriosIfNotExist();
}
function downloadFile(url: string, arq: string, callback: () => void) {
	const file = createWriteStream(arq);
	const request = https.get(url, (response) => { response.pipe(file); });
	file.on("finish", () => {
		file.close();
		callback();
	});
	request.on("error", (err) => {
		console.log(err);
		unlink(arq, (e) => { console.log(e); });
	});
	file.on("error", (err) => {
		console.log(err);
		unlink(arq, (e) => { console.log(e); });
	});
}

function createDiretoriosIfNotExist(){
	if (!existsSync(diretorio_download)){
		mkdirSync(diretorio_download, { recursive: true });
	}
	if (!existsSync(diretorio_completo)){
		mkdirSync(diretorio_completo, { recursive: true });
	}
}

function sleep(ms: number) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

export { sleep, verifyNecessaryComponents, downloadFile, toTimeMS, toTime, StreamProc, Episodio, firebase_config, rclone_drive , diretorio_rclone, diretorio_rclone_config, diretorio_download, diretorio_completo, diretorio_ffmpeg, diretorio_mkvmerge, user_agent };