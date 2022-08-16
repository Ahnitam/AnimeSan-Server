import { Funiroll } from "./funiroll";
import { verifyNecessaryComponents } from "./util";

verifyNecessaryComponents();
const funiroll = new Funiroll();
let snapshot: VoidFunction;
(async () => {
	let primeira = true;
	snapshot = funiroll.db.collection("downloads").doc("fila").collection("items").onSnapshot((snapshot) => {
		if (primeira) {
			primeira = false;
			snapshot.forEach(document => {
				let ep_data = document.data();
				funiroll.downloads.Fila.push({
					id: document.id,
					animeName: ep_data.animeName,
					duration: ep_data.duration,
					episodeId: ep_data.episodeId,
					seasonEpisode: ep_data.seasonEpisode,
					seasonId: ep_data.seasonId,
					tipo: ep_data.tipo,
					stream: ep_data.stream,
					hardsub: ep_data.hardsub,
					softsub: ep_data.softsub,
				});
			});
			funiroll.baixarFila();
		}else{
			snapshot.docChanges().forEach((doc) => {
				if (doc.type == "added") {
					let ep_data = doc.doc.data();
					funiroll.downloads.Fila.push({
						id: doc.doc.id,
						animeName: ep_data.animeName,
						duration: ep_data.duration,
						episodeId: ep_data.episodeId,
						seasonEpisode: ep_data.seasonEpisode,
						seasonId: ep_data.seasonId,
						tipo: ep_data.tipo,
						stream: ep_data.stream,
						hardsub: ep_data.hardsub,
						softsub: ep_data.softsub,
					});
				}
			});
			if (!funiroll.isRunning) {
				funiroll.baixarFila();
			}
		}
	});
})();

process.on("SIGINT", () => {
	funiroll.isRunning = false;
	snapshot();
	funiroll.db.terminate();
});

process.on("SIGTERM", () => {
	funiroll.db.terminate();
});
