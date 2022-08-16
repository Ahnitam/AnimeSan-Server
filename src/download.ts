import { spawnSync } from "child_process";
import { unlink } from "fs";
import { join } from "path/posix";
import { sleep, StreamProc, Episodio, diretorio_completo, diretorio_rclone, diretorio_rclone_config, diretorio_mkvmerge, rclone_drive } from "./util";

class Download {
	episodio: Episodio;
	status: string;
	processos: StreamProc[];
	porcentagem: number;

	constructor(e: Episodio) {
		this.episodio = e;
		this.status = "Iniciando Download";
		this.processos = [];
		this.porcentagem = 0;
	}

	async verificarDownload(): Promise<boolean> {
		this.status = "Baixando";
		let completo = false;
		let last_update = Date.now();
		while (completo == false) {
			completo = true;
			let po = 0;
			let pe = 0;
			this.processos.forEach(str => {
				po += (str.porcentagem * str.peso);
				pe += str.peso;
				if (str.completo == false) {
					completo = false;
				}
			});

			if (completo == true) {
				this.porcentagem = 100;
				return true;
			}
			const p = Number((po / pe).toFixed(2));
			
			if (this.porcentagem == p){
				if(Date.now() - last_update > 300000){
					break;
				}
			}else{
				this.porcentagem = p;
				last_update = Date.now();
			}
			await sleep(1000);
		}
		return false;
	}

	async criarMKV(): Promise<boolean>{
		this.status = "Criando MKV";
		try {
			const arquivos: {name: string, id: string, medias: {ativo: boolean, type: string, args: string[]}[]}[] = [];
			this.processos.forEach(str => {
				switch (str.id) {
				case "video_leg":
					arquivos.push({name: str.arq, id: str.id, medias: [{ativo: true, type: "video", args: ["--language", "0:ja", "--track-name", "0:Japonês"]}, {ativo: true, type: "audio", args: ["--language", "1:ja", "--track-name", "1:Japonês", "--default-track", "1:yes"]}]});
					break;
				case "video_dub":
					for (let i = 0; i < arquivos.length; i++) {
						const element = arquivos[i];
						if (element.id == "video_leg") {
							element.medias.forEach(e => {
								if (e.type == "video" && this.episodio.stream.toUpperCase() == "FUNIMATION") {
									e.args.splice(0, e.args.length);
									e.ativo = false;
									e.args.push("--no-video");
								}
								else if (e.type == "audio") {
									for (let index = 0; index < e.args.length; index++) {
										if (e.args[index] == "--default-track") {
											e.args[index+1] = e.args[index+1].replace("yes", "no");
										}
									}
								}
							});
							break;
						}
					}
					if (this.episodio.stream.toUpperCase() == "CRUNCHYROLL") {
						arquivos.push({name: str.arq, id: str.id, medias: [{ativo: false, type: "video", args: ["--no-video"]}, {ativo: true, type: "audio", args: ["--language", "1:pt-BR", "--track-name", "1:Português (Brasil)", "--default-track", "1:yes"]}]});
					}else{
						arquivos.push({name: str.arq, id: str.id, medias: [{ativo: true, type: "video", args: ["--language", "0:ja", "--track-name", "0:Japonês"]}, {ativo: true, type: "audio", args: ["--language", "1:pt-BR", "--track-name", "1:Português (Brasil)", "--default-track", "1:yes"]}]});
					}
					break;
				case "audio_leg":
					for (let i = 0; i < arquivos.length; i++) {
						const element = arquivos[i];
						if (element.id == "video_leg") {
							element.medias.forEach(e => {
								if (e.type == "audio") {
									e.args.splice(0, e.args.length);
									e.ativo = false;
									e.args.push("--no-audio");
								}
							});
							break;
						}
					}
					arquivos.push({name: str.arq, id: str.id, medias: [{ativo: true,type: "audio", args: ["--language", "0:ja", "--track-name", "0:Japonês", "--default-track", (this.episodio.softsub.video.dub.url != null || this.episodio.softsub.audio.dub.url != null) ? "0:no" : "0:yes"]}]});
					break;
				case "audio_dub":
					for (let i = 0; i < arquivos.length; i++) {
						const element = arquivos[i];
						if (element.id == "video_leg") {
							element.medias.forEach(e => {
								if (e.type == "audio" && e.ativo) {
									for (let index = 0; index < e.args.length; index++) {
										if (e.args[index] == "--default-track") {
											e.args[index+1] = e.args[index+1].replace("yes", "no");
										}
									}
								}
							});
						}
						else if (element.id == "video_dub") {
							element.medias.forEach(e => {
								if (e.type == "audio") {
									e.args.splice(0, e.args.length);
									e.ativo = false;
									e.args.push("--no-audio");
								}
							});
							break;
						}
					}
					arquivos.push({name: str.arq, id: str.id, medias: [{ativo: true,type: "audio", args: ["--language", "0:pt-BR", "--track-name", "0:Português (Brasil)", "--default-track", "0:yes"]}]});
					break;
				case "legenda_leg":
					arquivos.push({name: str.arq, id: str.id, medias: [{ativo: true,type: "legenda", args: (this.episodio.softsub.video.dub.url != null || this.episodio.softsub.audio.dub.url != null) ? ["--language", "0:pt-BR", "--track-name", "0:Português (Brasil)", "--default-track", "0:no", "--forced-track", "0:no"] : ["--language", "0:pt-BR", "--track-name", "0:Português (Brasil)", "--default-track", "0:yes", "--forced-track", "0:yes"]}]});
					break;
				case "legenda_dub":
					arquivos.push({name: str.arq, id: str.id, medias: [{ativo: true,type: "legenda", args: ["--language", "0:pt-BR", "--track-name", "0:Português (Brasil)", "--default-track", "0:yes", "--forced-track", "0:yes"]}]});
					break;
				default:
					break;
				}
			});

			let command = ["--output", join(diretorio_completo, this.episodio.animeName + " - " + this.episodio.seasonEpisode + ".mkv")];
			const order: string[] = [];
			arquivos.forEach((e, k) => {
				e.medias.forEach((element, key) => {
					command = command.concat(element.args);
					if (element.ativo){
						if (element.type == "video") {
							order.unshift(k+":"+key);
						}else{
							order.push(k+":"+key);
						}
					}
				});
				command = command.concat(["(", e.name, ")"]);
			});
			command = command.concat(["--track-order", order.join(",")]);
			const m = spawnSync(diretorio_mkvmerge, command);
			if (typeof m.error != "undefined" || m.status != 0) throw m.error;
			return true;
		} catch {
			return false;
		}
	}

	async moveToDrive(): Promise<boolean>{
		this.status = "Movendo para o Drive";
		try {
			const m = spawnSync(diretorio_rclone, ["move", "--config", diretorio_rclone_config, join(diretorio_completo, this.episodio.animeName + " - " + this.episodio.seasonEpisode + ".mkv"), rclone_drive]);
			if (typeof m.error != "undefined" || m.status != 0) throw m.error;
			this.processos.forEach(str => {
				unlink(str.arq, (err) => console.log(err));
			});
			return true;
		} catch {
			return false;
		}
	}

}

export { Download };