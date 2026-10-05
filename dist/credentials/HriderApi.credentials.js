"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HriderApi = void 0;
class HriderApi {
    constructor() {
        this.name = "hriderApi";
        this.displayName = "HRider API";
        this.documentationUrl = "https://dev.hrider.net";
        this.icon = {
            light: "file:../nodes/Hrider/hrider.svg",
            dark: "file:../nodes/Hrider/hrider.dark.svg"
        };
        this.properties = [
            {
                displayName: "Authorization",
                name: "secret",
                type: "string",
                typeOptions: {
                    password: true
                },
                default: "",
                required: true
            }
        ];
        this.authenticate = {
            type: "generic",
            properties: {
                headers: {
                    Authorization: "={{$credentials.secret}}"
                }
            }
        };
        this.test = {
            request: {
                baseURL: "https://dev.hrider.net",
                url: "/api/v1/administrators"
            }
        };
    }
}
exports.HriderApi = HriderApi;
//# sourceMappingURL=HriderApi.credentials.js.map