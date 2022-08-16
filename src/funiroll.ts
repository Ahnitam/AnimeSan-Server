import { spawn } from "child_process";
import { existsSync, readFileSync, unlink, writeFileSync } from "fs";
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { join } from "path";
import { Download } from "./download";
import { diretorio_download, diretorio_ffmpeg, downloadFile, Episodio, firebase_config, StreamProc, toTime, toTimeMS, user_agent } from "./util";

class Funiroll {
	isRunning = false;
	db;
	//downloads: { Fila: Episodio[], Andamento: Download[], Baixado: Download[], Concluido: Download[], Erro: Download[] } = { Fila: [], Andamento: [], Baixado: [], Concluido: [], Erro: [] };
	downloads: { Fila: Episodio[] } = { Fila: [] };

	constructor() {
		initializeApp({
			credential: cert({
				projectId: firebase_config.projectId,
				privateKey: firebase_config.privateKey,
				clientEmail: firebase_config.clientEmail,
			})
		});
		this.db = getFirestore();
	}

	sleep(ms: number) {
		return new Promise((resolve) => {
			setTimeout(resolve, ms);
		});
	}

	async baixarFila() {
		this.isRunning = true;
		while (this.downloads.Fila.length > 0 && this.isRunning) {
			await this.adicionarDownload(this.downloads.Fila.splice(0, 1)[0]);
		}
		this.isRunning = false;
	}

	async adicionarDownload(download: Episodio) {
		await this.db.collection("downloads").doc("fila").collection("items").doc(download.id).delete();
		const d: Download = new Download(download);
		//this.downloads.Andamento.push(d);

		const streamId = download.id.split("_")[0];

		await this.updateDatabase("andamento", d);

		const skip = await this.db.collection('skip').doc(streamId + "_" + download.seasonId).get();

		if (download.softsub.video.leg.url != null) {
			this.downloadURL(d, "video_leg", (download.stream.toUpperCase() == "CRUNCHYROLL" ? 5 : 2), download.softsub.video.leg.url, join(diretorio_download, download.animeName + " - " + download.seasonEpisode + ".mp4"), ((skip.exists) ? skip.data()!.leg : 0) + "ms");
		}
		if (download.softsub.video.dub.url != null) {
			this.downloadURL(d, "video_dub", (download.stream.toUpperCase() == "CRUNCHYROLL" ? 2 : 5), download.softsub.video.dub.url, join(diretorio_download, download.animeName + " - " + download.seasonEpisode + "-DUB.mp4"), ((skip.exists) ? skip.data()!.dub : 0) + "ms");
		}
		if (download.softsub.audio.leg.url != null) {
			this.downloadURL(d, "audio_leg", 2, download.softsub.audio.leg.url, join(diretorio_download, download.animeName + " - " + download.seasonEpisode + ".aac"), ((skip.exists) ? skip.data()!.leg : 0) + "ms");
		}
		if (download.softsub.audio.dub.url != null) {
			this.downloadURL(d, "audio_dub", 2, download.softsub.audio.dub.url, join(diretorio_download, download.animeName + " - " + download.seasonEpisode + "-DUB.aac"), ((skip.exists) ? skip.data()!.dub : 0) + "ms");
		}
		if (download.softsub.legenda.leg.url != null) {
			const str = { id: "legenda_leg", completo: false, peso: 0, porcentagem: 100, proc: undefined, arq: join(diretorio_download, download.animeName + " - " + download.seasonEpisode + "." + download.softsub.legenda.leg?.type) };
			d.processos.push(str);
			downloadFile(download.softsub.legenda.leg.url, join(diretorio_download, download.animeName + " - " + download.seasonEpisode + "." + download.softsub.legenda.leg.type), () => {
				let file = readFileSync(join(diretorio_download, download.animeName + " - " + download.seasonEpisode + "." + download.softsub.legenda.leg?.type), { encoding: "utf-8" });
				let times = file.matchAll(/(?<time>(?<h>\d{1,}):(?<m>\d{2}):(?<s>\d{2}[\.,]\d{2,3}))/g);
				for (let time of times) {
					file = file.replaceAll(time.groups!["time"], toTime(toTimeMS(time.groups!["h"], time.groups!["m"], time.groups!["s"]) - ((skip.exists) ? Number(skip.data()!.leg) : 0)));
				}
				writeFileSync(join(diretorio_download, download.animeName + " - " + download.seasonEpisode + "." + download.softsub.legenda.leg?.type), file, "utf-8");
				str.completo = true;
			});
		}
		if (download.softsub.legenda.dub.url != null) {
			const str = { id: "legenda_dub", completo: false, peso: 0, porcentagem: 100, proc: undefined, arq: join(diretorio_download, download.animeName + " - " + download.seasonEpisode + "-DUB." + download.softsub.legenda.dub?.type) };
			d.processos.push(str);
			downloadFile(download.softsub.legenda.dub.url, join(diretorio_download, download.animeName + " - " + download.seasonEpisode + "-DUB." + download.softsub.legenda.dub.type), () => {
				let file = readFileSync(join(diretorio_download, download.animeName + " - " + download.seasonEpisode + "-DUB." + download.softsub.legenda.dub?.type), { encoding: "utf-8" });
				let times = file.matchAll(/(?<time>(?<h>\d{1,}):(?<m>\d{2}):(?<s>\d{2}[\.,]\d{2,3}))/g);
				for (let time of times) {
					file = file.replaceAll(time.groups!["time"], toTime(toTimeMS(time.groups!["h"], time.groups!["m"], time.groups!["s"]) - ((skip.exists) ? Number(skip.data()!.dub) : 0)));
				}
				writeFileSync(join(diretorio_download, download.animeName + " - " + download.seasonEpisode + "-DUB." + download.softsub.legenda.dub?.type), file, "utf-8");
				str.completo = true;
			});
		}

		let verify = await d.verificarDownload();
		this.db.collection("downloads").doc("andamento").collection("items").doc(d.episodio.id).delete();
		if (verify) {
			d.status = "Criando MKV";
			await this.updateDatabase("baixado", d);
			// this.downloads.Baixado.push(this.downloads.Andamento.splice(this.downloads.Andamento.indexOf(d), 1)[0]);
			verify = await d.criarMKV();
			if (verify) {
				d.status = "Movendo para o Drive";
				await this.updateDatabase("baixado", d);
				verify = await d.moveToDrive();
				this.db.collection("downloads").doc("baixado").collection("items").doc(d.episodio.id).delete();
				if (verify) {
					d.status = "Download Completo";
					await this.updateDatabase("concluido", d);
					// this.downloads.Concluido.push(this.downloads.Baixado.splice(this.downloads.Baixado.indexOf(d), 1)[0]);
					console.log("Movido com sucesso");
				}
				else {
					d.status = "Erro ao mover para o drive";
					await this.updateDatabase("erro", d);
					// this.downloads.Erro.push(this.downloads.Baixado.splice(this.downloads.Baixado.indexOf(d), 1)[0]);
					console.log("Erro ao mover para o drive");
					d.processos.forEach(str => {
						unlink(str.arq, (err) => console.log(err));
					});
				}
			}
			else {
				this.db.collection("downloads").doc("baixado").collection("items").doc(d.episodio.id).delete();
				d.status = "Erro ao criar MKV";
				await this.updateDatabase("erro", d);
				// this.downloads.Erro.push(this.downloads.Baixado.splice(this.downloads.Baixado.indexOf(d), 1)[0]);
				console.log("Erro ao criar mkv");
				d.processos.forEach(str => {
					unlink(str.arq, (err) => console.log(err));
				});
			}
		} else {
			d.status = "Erro ao baixar";
			await this.updateDatabase("erro", d);
			// this.downloads.Erro.push(this.downloads.Andamento.splice(this.downloads.Andamento.indexOf(d), 1)[0]);
			console.log("Erro ao Baixar");
			d.processos.forEach(str => {
				unlink(str.arq, (err) => console.log(err));
			});
		}
	}

	private updateDatabase(type: string, download: Download) {
		return this.db.collection("downloads").doc(type).collection("items").doc(download.episodio.id).set({
			animeName: download.episodio.animeName,
			duration: download.episodio.duration,
			episodeId: download.episodio.episodeId,
			seasonEpisode: download.episodio.seasonEpisode,
			seasonId: download.episodio.seasonId,
			tipo: download.episodio.tipo,
			stream: download.episodio.stream,
			hardsub: download.episodio.hardsub,
			softsub: download.episodio.softsub,
			status: download.status,
		});
	}

	private downloadURL(down: Download, id: string, peso: number, url: string, arq: string, skip_duracao_ms: string) {
		const str: StreamProc = { id: id, completo: false, peso: peso, porcentagem: 0, proc: spawn(diretorio_ffmpeg, ["-user_agent", user_agent, "-i", url, "-ss", skip_duracao_ms, "-v", "quiet", "-stats", "-c", "copy", "-y", arq]), arq: arq };
		str.proc?.stderr.on("data", (data) => {
			const out: string = data.toString();
			if (str.proc?.exitCode == null) {
				const result = out.match(/time=(?<horas>\d{2}):(?<minutos>\d{2}):(?<segundos>\d{2})/);
				if (result != null && typeof result.groups != "undefined") {
					const time = (parseInt(result.groups.horas) * 3600000) + (parseInt(result.groups.minutos) * 60000) + (parseInt(result.groups.segundos) * 1000);
					str.porcentagem = ((time * 100) / down.episodio.duration);
				}
			}
		});
		str.proc?.on("exit", (code) => {
			console.log(code);
			if (existsSync(arq)) {
				str.completo = true;
				str.porcentagem = 100;
			}
		});
		down.processos.push(str);
	}
}

export { Funiroll };