import { type IAuthenticateGeneric, type Icon, type ICredentialTestRequest, type ICredentialType, type INodeProperties } from "n8n-workflow";

// Generated with ts-morph
export class HriderApi implements ICredentialType {
  name = "hriderApi";
  displayName = "HRider API";
  documentationUrl = "https://dev.hrider.net";
  icon: Icon = {
        light: "file:../nodes/Hrider/hrider.svg",
        dark: "file:../nodes/Hrider/hrider.dark.svg"
    };
  properties: INodeProperties[] = [
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
  authenticate: IAuthenticateGeneric = {
        type: "generic",
        properties: {
            headers: {
                Authorization: "={{$credentials.secret}}"
            }
        }
    };
  test: ICredentialTestRequest = {
        request: {
            baseURL: "https://dev.hrider.net",
            url: "/api/v1/administrators"
        }
    };
}
