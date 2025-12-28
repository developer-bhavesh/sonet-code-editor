export namespace main {
	
	export class FileInfo {
	    name: string;
	    path: string;
	    isDir: boolean;
	    size: number;
	    modified: string;
	
	    static createFrom(source: any = {}) {
	        return new FileInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.isDir = source["isDir"];
	        this.size = source["size"];
	        this.modified = source["modified"];
	    }
	}

}

