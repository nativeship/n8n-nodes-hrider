"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Hrider = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const http_1 = require("../../shared/http");
function normalizeParameterValue(value) {
    if (value && typeof value === 'object' && 'value' in value)
        return value.value;
    return value;
}
function normalizeJsonValue(value, label, context, itemIndex) {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed)
            return {};
        try {
            return JSON.parse(trimmed);
        }
        catch (error) {
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${label} must be valid JSON: ${error.message}`, { itemIndex });
        }
    }
    if (value === null || Array.isArray(value) || (value && typeof value === 'object') || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
        return value;
    throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${label} must be valid JSON`, { itemIndex });
}
function validateBodyValue(value, contract, path, context, itemIndex) {
    var _a, _b, _c, _d, _e;
    if (value === undefined || value === '') {
        if (contract.required)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} is required`, { itemIndex });
        return;
    }
    if (value === null) {
        if (contract.nullable)
            return;
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must not be null`, { itemIndex });
    }
    if ((_a = contract.alternatives) === null || _a === void 0 ? void 0 : _a.length) {
        selectAlternativeValue(value, contract, path, context, itemIndex);
        return;
    }
    if (contract.type === 'string' && typeof value !== 'string')
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a string`, { itemIndex });
    if (contract.type === 'boolean' && typeof value !== 'boolean')
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a boolean`, { itemIndex });
    if (contract.type === 'number' && typeof value !== 'number')
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a number`, { itemIndex });
    if (contract.type === 'integer' && (typeof value !== 'number' || !Number.isInteger(value)))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be an integer`, { itemIndex });
    if ((_b = contract.enum) === null || _b === void 0 ? void 0 : _b.length) {
        const enumValueMatches = (candidate) => candidate === value ||
            (candidate === null && value === 'null') ||
            (candidate === 'null' && value === null) ||
            Boolean(candidate && value && typeof candidate === 'object' && typeof value === 'object' && JSON.stringify(candidate) === JSON.stringify(value));
        const scalarEnum = contract.enum.every((candidate) => candidate === null || ['string', 'number', 'boolean'].includes(typeof candidate));
        const matches = contract.type === 'array' && Array.isArray(value) && scalarEnum
            ? value.every((item) => contract.enum.some((candidate) => candidate === item || (candidate === null && item === 'null') || (candidate === 'null' && item === null)))
            : contract.enum.some(enumValueMatches);
        if (!matches)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be one of: ${contract.enum.join(', ')}`, { itemIndex });
    }
    if (contract.type === 'number' || contract.type === 'integer') {
        const numeric = value;
        if (contract.minValue !== undefined && numeric < contract.minValue)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be at least ${contract.minValue}`, { itemIndex });
        if (contract.maxValue !== undefined && numeric > contract.maxValue)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be at most ${contract.maxValue}`, { itemIndex });
    }
    if (contract.pattern && typeof value === 'string' && !new RegExp(contract.pattern).test(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must match ${contract.pattern}`, { itemIndex });
    if (contract.format === 'email' && typeof value === 'string' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be an email address`, { itemIndex });
    if ((contract.format === 'uri' || contract.format === 'url') && typeof value === 'string') {
        try {
            new URL(value);
        }
        catch {
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a URL`, { itemIndex });
        }
    }
    if (contract.format === 'uuid' && typeof value === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a UUID`, { itemIndex });
    if (contract.type === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value))
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a JSON object`, { itemIndex });
        const objectValue = value;
        for (const child of (_c = contract.fields) !== null && _c !== void 0 ? _c : [])
            validateBodyValue(objectValue[child.name], child, `${path}.${child.name}`, context, itemIndex);
        if (contract.additionalValue) {
            const known = new Set(((_d = contract.fields) !== null && _d !== void 0 ? _d : []).map((field) => field.name));
            for (const [key, childValue] of Object.entries(objectValue)) {
                if (!known.has(key)) {
                    if (((_e = contract.additionalValue.alternatives) === null || _e === void 0 ? void 0 : _e.length) && contract.additionalValue.representation === 'raw')
                        continue;
                    validateBodyValue(childValue, contract.additionalValue, `${path}.${key}`, context, itemIndex);
                }
            }
        }
    }
    if (contract.type === 'array') {
        if (!Array.isArray(value))
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a JSON array`, { itemIndex });
        if (contract.items)
            value.forEach((item, index) => validateBodyValue(item, contract.items, `${path}[${index}]`, context, itemIndex));
    }
}
function setBodyField(body, contract, value, context, itemIndex) {
    var _a, _b;
    const normalized = contract.type === 'object' || contract.type === 'array' || contract.type === 'alternative' || contract.representation === 'raw'
        ? normalizeJsonValue(value, (_a = contract.displayName) !== null && _a !== void 0 ? _a : contract.name, context, itemIndex)
        : normalizeParameterValue(value);
    const selected = ((_b = contract.alternatives) === null || _b === void 0 ? void 0 : _b.length) ? selectAlternativeValue(normalized, contract, contract.name, context, itemIndex) : normalized;
    validateBodyValue(selected, { ...contract, alternatives: undefined, composition: undefined }, contract.name, context, itemIndex);
    body[contract.name] = selected;
}
function selectAlternativeValue(value, contract, path, context, itemIndex) {
    var _a, _b, _c;
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must include an explicit schema alternative and value`, { itemIndex });
    const selectedName = String((_a = value.schemaAlternative) !== null && _a !== void 0 ? _a : '');
    const selected = ((_b = contract.alternatives) !== null && _b !== void 0 ? _b : []).find((alternative) => alternative.name === selectedName);
    if (!selected)
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} schema alternative must be one of: ${((_c = contract.alternatives) !== null && _c !== void 0 ? _c : []).map((alternative) => alternative.name).join(', ')}`, { itemIndex });
    const selectedValue = value.value;
    validateBodyValue(selectedValue, selected, path, context, itemIndex);
    return selectedValue;
}
function encodeFormValue(value) {
    if (value === null)
        return 'null';
    if (Array.isArray(value) || (value && typeof value === 'object'))
        return JSON.stringify(value);
    return String(value);
}
function toFormData(body) {
    const form = new FormData();
    for (const [key, value] of Object.entries(body))
        form.append(key, encodeFormValue(value));
    return form;
}
function selectResponseFields(value, fields) {
    if (fields.length === 0)
        return value;
    const selected = {};
    if (value.id !== undefined)
        selected.id = value.id;
    for (const field of fields)
        if (value[field] !== undefined)
            selected[field] = value[field];
    return selected;
}
function valueAtPath(value, path) {
    if (!path)
        return value;
    return path.split('.').filter(Boolean).reduce((current, segment) => {
        if (current === undefined || current === null)
            return undefined;
        if (Array.isArray(current))
            return current[Number(segment)];
        return current[segment];
    }, value);
}
class Hrider {
    constructor() {
        this.description = {
            displayName: "HRider",
            name: "hrider",
            icon: {
                light: "file:hrider.svg",
                dark: "file:hrider.dark.svg"
            },
            group: [],
            version: [
                1
            ],
            subtitle: "={{((JSON.parse(\"\\u007b\\\"administrators\\\":\\u007b\\\"changePassword\\\":\\\"changeAdministratorPassword: administrator\\\",\\\"createAdministrator\\\":\\\"createAdministrator: administrator\\\",\\\"deleteAdministrator\\\":\\\"deleteAdministrator: administrator\\\",\\\"getAdministrator\\\":\\\"getAdministrator: administrator\\\",\\\"getAdministrators\\\":\\\"listAdministrators: administrator\\\",\\\"getCompanies\\\":\\\"listAssignedCompanies: administrator\\\",\\\"relateCompanies\\\":\\\"assignCompaniesToAdministrator: administrator\\\",\\\"unrelateCompanies\\\":\\\"removeCompanyAssignments: administrator\\\",\\\"updateAdministrator\\\":\\\"updateAdministrator: administrator\\\"\\u007d,\\\"appraisals\\\":\\u007b\\\"getAppraisal\\\":\\\"getAppraisal: appraisal\\\",\\\"getAppraisals\\\":\\\"listAppraisals: appraisal\\\",\\\"getFeedbackActionPlanReport\\\":\\\"downloadFeedbackActionPlanReport: appraisal\\\",\\\"getFeedbackCommentsReport\\\":\\\"downloadFeedbackCommentsReport: appraisal\\\",\\\"getFeedbackDatabaseResponses\\\":\\\"downloadEvaluatorResponses: appraisal\\\",\\\"getFeedbackDetailReport\\\":\\\"downloadFeedbackDetailReport: appraisal\\\",\\\"getFeedbackGroupDetailReport\\\":\\\"downloadFeedbackDetailByGroup: appraisal\\\",\\\"getFeedbackReport\\\":\\\"downloadEmployeeFeedbackReport: appraisal\\\",\\\"getFeedbackReports\\\":\\\"listFeedbackReports: appraisal\\\",\\\"getFeedbackResultsAgeReport\\\":\\\"downloadFeedbackResultsByAge: appraisal\\\",\\\"getFeedbackResultsAntiquityReport\\\":\\\"downloadFeedbackResultsByTenure: appraisal\\\",\\\"getFeedbackResultsGenderReport\\\":\\\"downloadFeedbackResultsByGender: appraisal\\\",\\\"getFeedbackResultsJobsReport\\\":\\\"downloadFeedbackResultsByJobPosition: appraisal\\\",\\\"getFeedbackResultsReport\\\":\\\"downloadFeedbackResultsReport: appraisal\\\",\\\"getInvitation\\\":\\\"getInvitation: appraisal\\\",\\\"getInvitations\\\":\\\"listInvitations: appraisal\\\",\\\"getNBoxResultsReport\\\":\\\"downloadNboxResultsReport: appraisal\\\",\\\"getReports\\\":\\\"listReports: appraisal\\\",\\\"getSurveyListReport\\\":\\\"downloadSurveyListReport: appraisal\\\",\\\"getWorkingEnvAgeGenderReport\\\":\\\"downloadWorkingEnvironmentResultsByAgeGender: appraisal\\\",\\\"getWorkingEnvAllReport\\\":\\\"downloadFullWorkingEnvironmentReport: appraisal\\\",\\\"getWorkingEnvAntiquityReport\\\":\\\"downloadWorkingEnvironmentResultsByTenure: appraisal\\\",\\\"getWorkingEnvDeptsReport\\\":\\\"downloadWorkingEnvironmentResultsByDepartment: appraisal\\\",\\\"getWorkingEnvGroupsReport\\\":\\\"downloadWorkingEnvironmentResultsByIndicator: appraisal\\\",\\\"getWorkingEnvIndicatorsReport\\\":\\\"downloadWorkingEnvironmentResultsByIndicator: appraisal\\\",\\\"getWorkingEnvJobsReport\\\":\\\"downloadWorkingEnvironmentResultsJobPosition: appraisal\\\",\\\"getWorkingEnvironmentFeedbackReport\\\":\\\"downloadWorkingEnvironmentFeedbackReport: appraisal\\\",\\\"getWorkingEnvironmentReport\\\":\\\"downloadWorkingEnvironmentReport: appraisal\\\",\\\"resendInvitation\\\":\\\"resendAppraisalInvitation: appraisal\\\"\\u007d,\\\"companies\\\":\\u007b\\\"createCompany\\\":\\\"createCompany: company\\\",\\\"deleteCompany\\\":\\\"deleteCompany: company\\\",\\\"deleteCompanyLogo\\\":\\\"deleteCompanyLogo: company\\\",\\\"getAdministrators_1\\\":\\\"listCompanyAdministrators: company\\\",\\\"getCompanies_1\\\":\\\"listCompanies: company\\\",\\\"getCompany\\\":\\\"getCompany: company\\\",\\\"getCompanyLogo\\\":\\\"getCompanyLogo: company\\\",\\\"relateAdministrators\\\":\\\"assignAdministratorsToCompany: company\\\",\\\"setCompanyLogo\\\":\\\"uploadCompanyLogo: company\\\",\\\"unrelateAdministrators\\\":\\\"removeCompanyAdministrators: company\\\",\\\"updateCompany\\\":\\\"updateCompany: company\\\"\\u007d,\\\"departments\\\":\\u007b\\\"createDepartment\\\":\\\"createDepartment: department\\\",\\\"createPosition\\\":\\\"createJobPosition: department\\\",\\\"deleteDepartment\\\":\\\"deleteDepartment: department\\\",\\\"deleteEmployees\\\":\\\"unassignEmployeesFromPosition: department\\\",\\\"deletePosition\\\":\\\"deleteJobPosition: department\\\",\\\"getChildren\\\":\\\"listChildDepartments: department\\\",\\\"getDepartment\\\":\\\"getDepartment: department\\\",\\\"getDepartments\\\":\\\"listDepartments: department\\\",\\\"getEmployees\\\":\\\"listPositionEmployees: department\\\",\\\"getParent\\\":\\\"getParentDepartment: department\\\",\\\"getPosition\\\":\\\"getJobPosition: department\\\",\\\"getPositions\\\":\\\"listJobPositions: department\\\",\\\"movePosition\\\":\\\"movePositionToDepartment: department\\\",\\\"setEmployees\\\":\\\"assignEmployeesToPosition: department\\\",\\\"setParent\\\":\\\"setParentDepartment: department\\\",\\\"updateDepartment\\\":\\\"updateDepartment: department\\\"\\u007d,\\\"employees\\\":\\u007b\\\"createEmployee\\\":\\\"createEmployee: employee\\\",\\\"deleteClients\\\":\\\"removeEmployeeClients: employee\\\",\\\"deleteEmployee\\\":\\\"archiveOrDeleteEmployee: employee\\\",\\\"deleteEmployeePhoto\\\":\\\"deleteEmployeePhoto: employee\\\",\\\"deletePosition_1\\\":\\\"unassignEmployeePosition: employee\\\",\\\"deleteSubordinates\\\":\\\"removeSubordinates: employee\\\",\\\"deleteSupervisor\\\":\\\"unassignEmployeeSupervisor: employee\\\",\\\"getClients\\\":\\\"listEmployeeClients: employee\\\",\\\"getEmployee\\\":\\\"getEmployee: employee\\\",\\\"getEmployeePhoto\\\":\\\"getEmployeePhoto: employee\\\",\\\"getEmployees_1\\\":\\\"listEmployees: employee\\\",\\\"getFeedbackReports_1\\\":\\\"listEmployeeFeedbackReports: employee\\\",\\\"getPosition_1\\\":\\\"getEmployeePosition: employee\\\",\\\"getSubordinates\\\":\\\"listSubordinates: employee\\\",\\\"getSupervisor\\\":\\\"getEmployeeSupervisor: employee\\\",\\\"setClients\\\":\\\"assignClientsToEmployee: employee\\\",\\\"setEmployeePhoto\\\":\\\"uploadEmployeePhoto: employee\\\",\\\"setPosition\\\":\\\"assignEmployeePosition: employee\\\",\\\"setSubordinates\\\":\\\"assignSubordinates: employee\\\",\\\"setSupervisor\\\":\\\"assignEmployeeSupervisor: employee\\\",\\\"updateEmployee\\\":\\\"updateEmployee: employee\\\"\\u007d,\\\"files\\\":\\u007b\\\"getFile\\\":\\\"getFile: file\\\"\\u007d\\u007d\"))[$parameter[\"resource\"]] || {})[$parameter[\"operation\"]] || ($parameter[\"operation\"] + \": \" + $parameter[\"resource\"])}}",
            description: "HRider helps teams manage performance reviews, 360-degree feedback, and people analytics",
            documentationUrl: "https://dev.hrider.net",
            hints: [
                {
                    message: "Operation \"getAppraisals\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"getInvitations\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"getFeedbackReports\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"getEmployees_1\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                }
            ],
            defaults: {
                name: "HRider"
            },
            usableAsTool: true,
            inputs: [
                n8n_workflow_1.NodeConnectionTypes.Main
            ],
            outputs: [
                n8n_workflow_1.NodeConnectionTypes.Main
            ],
            credentials: [
                {
                    name: "hriderApi",
                    required: true
                }
            ],
            properties: [
                {
                    displayName: "Resource",
                    name: "resource",
                    type: "options",
                    noDataExpression: true,
                    default: "administrators",
                    options: [
                        {
                            name: "Administrator",
                            value: "administrators"
                        },
                        {
                            name: "Appraisal",
                            value: "appraisals"
                        },
                        {
                            name: "Company",
                            value: "companies"
                        },
                        {
                            name: "Department",
                            value: "departments"
                        },
                        {
                            name: "Employee",
                            value: "employees"
                        },
                        {
                            name: "File",
                            value: "files"
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "administrators"
                            ]
                        }
                    },
                    default: "changePassword",
                    options: [
                        {
                            name: "Assign Companies To",
                            value: "relateCompanies",
                            action: "Assign companies to administrator",
                            description: "Assign one or more companies to an administrator using a `text/URI-list`"
                        },
                        {
                            name: "Change Administrator Password",
                            value: "changePassword",
                            action: "Change administrator password",
                            description: "Change the password for an administrator"
                        },
                        {
                            name: "Create",
                            value: "createAdministrator",
                            action: "Create administrator",
                            description: "Create an administrator. hrider assigns a random initial password; change it with the change password operation."
                        },
                        {
                            name: "Delete",
                            value: "deleteAdministrator",
                            action: "Delete administrator",
                            description: "Delete an administrator"
                        },
                        {
                            name: "Get",
                            value: "getAdministrator",
                            action: "Get administrator",
                            description: "Retrieve an administrator by ID"
                        },
                        {
                            name: "List",
                            value: "getAdministrators",
                            action: "List administrators",
                            description: "List account administrators. use `companyid` to return only administrators assigned to that company."
                        },
                        {
                            name: "List Assigned Companies",
                            value: "getCompanies",
                            action: "List assigned companies administrators",
                            description: "List the companies assigned to an administrator"
                        },
                        {
                            name: "Remove Company Assignments",
                            value: "unrelateCompanies",
                            action: "Remove company assignments administrators",
                            description: "Remove one or more company assignments from an administrator using a `text/URI-list`"
                        },
                        {
                            name: "Update",
                            value: "updateAdministrator",
                            action: "Update administrator",
                            description: "Update an administrator's details"
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Administrator ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "administrators"
                            ],
                            operation: [
                                "changePassword"
                            ]
                        }
                    }
                },
                {
                    displayName: "Body JSON",
                    name: "bodyJson",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Raw request body",
                    displayOptions: {
                        show: {
                            resource: [
                                "administrators"
                            ],
                            operation: [
                                "changePassword"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "administrators"
                            ],
                            operation: [
                                "createAdministrator"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Address",
                            name: "address",
                            type: "string",
                            default: "",
                            description: "Postal address"
                        },
                        {
                            displayName: "City",
                            name: "city",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Country",
                            name: "country",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Date Created",
                            name: "dateCreated",
                            type: "string",
                            default: "",
                            description: "Date the administrator record was created"
                        },
                        {
                            displayName: "Date Modified",
                            name: "dateModified",
                            type: "string",
                            default: "",
                            description: "Date the administrator record was last modified"
                        },
                        {
                            displayName: "Email",
                            name: "email",
                            type: "string",
                            default: "",
                            description: "Email address",
                            placeholder: "name@email.com"
                        },
                        {
                            displayName: "Embedded",
                            name: "_embedded",
                            type: "collection",
                            default: {},
                            placeholder: "Add Field",
                            options: [
                                {
                                    displayName: "Companies",
                                    name: "companies",
                                    type: "json",
                                    default: [],
                                    description: "List of companies that an administrator can access"
                                }
                            ],
                            description: "Administratorembedded"
                        },
                        {
                            displayName: "First Name",
                            name: "firstName",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "ID",
                            name: "id",
                            type: "number",
                            default: 0,
                            description: "Administrator ID"
                        },
                        {
                            displayName: "Language",
                            name: "language",
                            type: "options",
                            default: "es",
                            description: "Language used in the hrider interface",
                            options: [
                                {
                                    name: "Ca",
                                    value: "ca"
                                },
                                {
                                    name: "De",
                                    value: "de"
                                },
                                {
                                    name: "En",
                                    value: "en"
                                },
                                {
                                    name: "Es",
                                    value: "es"
                                },
                                {
                                    name: "Fr",
                                    value: "fr"
                                },
                                {
                                    name: "It",
                                    value: "it"
                                },
                                {
                                    name: "Pt",
                                    value: "pt"
                                }
                            ]
                        },
                        {
                            displayName: "Last Name",
                            name: "lastName",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Links",
                            name: "_links",
                            type: "collection",
                            default: {},
                            placeholder: "Add Field",
                            options: [
                                {
                                    displayName: "Change Password",
                                    name: "changePassword",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Companies",
                                    name: "companies",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Self",
                                    name: "self",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                }
                            ],
                            description: "Administratorlinks"
                        },
                        {
                            displayName: "National ID",
                            name: "nationalId",
                            type: "string",
                            default: "",
                            description: "Administrator national identification number"
                        },
                        {
                            displayName: "Organization",
                            name: "organization",
                            type: "string",
                            default: "",
                            description: "Organization name"
                        },
                        {
                            displayName: "Phone",
                            name: "phone",
                            type: "string",
                            default: "",
                            description: "Phone number"
                        },
                        {
                            displayName: "Postal Code",
                            name: "postalCode",
                            type: "string",
                            default: ""
                        }
                    ]
                },
                {
                    displayName: "Output",
                    name: "outputMode",
                    type: "options",
                    default: "simplified",
                    description: "Choose whether to return useful fields, the raw response, or selected fields",
                    displayOptions: {
                        show: {
                            resource: [
                                "administrators"
                            ],
                            operation: [
                                "createAdministrator"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Raw",
                            value: "raw",
                            description: "Return the complete API response"
                        },
                        {
                            name: "Selected Fields",
                            value: "selected",
                            description: "Return only selected fields"
                        },
                        {
                            name: "Simplified",
                            value: "simplified",
                            description: "Return up to 10 useful fields"
                        }
                    ]
                },
                {
                    displayName: "Fields to Include",
                    name: "selectedFields",
                    type: "multiOptions",
                    default: [
                        "id",
                        "email",
                        "address",
                        "city",
                        "country",
                        "dateCreated",
                        "dateModified",
                        "firstName",
                        "language",
                        "lastName"
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "administrators"
                            ],
                            operation: [
                                "createAdministrator"
                            ],
                            outputMode: [
                                "selected"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Address",
                            value: "address"
                        },
                        {
                            name: "City",
                            value: "city"
                        },
                        {
                            name: "Country",
                            value: "country"
                        },
                        {
                            name: "DateCreated",
                            value: "dateCreated"
                        },
                        {
                            name: "DateModified",
                            value: "dateModified"
                        },
                        {
                            name: "Email",
                            value: "email"
                        },
                        {
                            name: "Embedded",
                            value: "_embedded"
                        },
                        {
                            name: "FirstName",
                            value: "firstName"
                        },
                        {
                            name: "ID",
                            value: "id"
                        },
                        {
                            name: "Language",
                            value: "language"
                        },
                        {
                            name: "LastName",
                            value: "lastName"
                        },
                        {
                            name: "Links",
                            value: "_links"
                        },
                        {
                            name: "NationalId",
                            value: "nationalId"
                        },
                        {
                            name: "Organization",
                            value: "organization"
                        },
                        {
                            name: "Phone",
                            value: "phone"
                        },
                        {
                            name: "PostalCode",
                            value: "postalCode"
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Administrator ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "administrators"
                            ],
                            operation: [
                                "deleteAdministrator"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Administrator ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "administrators"
                            ],
                            operation: [
                                "getAdministrator"
                            ]
                        }
                    }
                },
                {
                    displayName: "Output",
                    name: "outputMode",
                    type: "options",
                    default: "simplified",
                    description: "Choose whether to return useful fields, the raw response, or selected fields",
                    displayOptions: {
                        show: {
                            resource: [
                                "administrators"
                            ],
                            operation: [
                                "getAdministrator"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Raw",
                            value: "raw",
                            description: "Return the complete API response"
                        },
                        {
                            name: "Selected Fields",
                            value: "selected",
                            description: "Return only selected fields"
                        },
                        {
                            name: "Simplified",
                            value: "simplified",
                            description: "Return up to 10 useful fields"
                        }
                    ]
                },
                {
                    displayName: "Fields to Include",
                    name: "selectedFields",
                    type: "multiOptions",
                    default: [
                        "id",
                        "email",
                        "address",
                        "city",
                        "country",
                        "dateCreated",
                        "dateModified",
                        "firstName",
                        "language",
                        "lastName"
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "administrators"
                            ],
                            operation: [
                                "getAdministrator"
                            ],
                            outputMode: [
                                "selected"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Address",
                            value: "address"
                        },
                        {
                            name: "City",
                            value: "city"
                        },
                        {
                            name: "Country",
                            value: "country"
                        },
                        {
                            name: "DateCreated",
                            value: "dateCreated"
                        },
                        {
                            name: "DateModified",
                            value: "dateModified"
                        },
                        {
                            name: "Email",
                            value: "email"
                        },
                        {
                            name: "Embedded",
                            value: "_embedded"
                        },
                        {
                            name: "FirstName",
                            value: "firstName"
                        },
                        {
                            name: "ID",
                            value: "id"
                        },
                        {
                            name: "Language",
                            value: "language"
                        },
                        {
                            name: "LastName",
                            value: "lastName"
                        },
                        {
                            name: "Links",
                            value: "_links"
                        },
                        {
                            name: "NationalId",
                            value: "nationalId"
                        },
                        {
                            name: "Organization",
                            value: "organization"
                        },
                        {
                            name: "Phone",
                            value: "phone"
                        },
                        {
                            name: "PostalCode",
                            value: "postalCode"
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "administrators"
                            ],
                            operation: [
                                "getAdministrators"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Company ID",
                            name: "companyId",
                            type: "number",
                            default: 0,
                            description: "Filter administrators by assigned company ID"
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Administrator ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "administrators"
                            ],
                            operation: [
                                "getCompanies"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Administrator ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "administrators"
                            ],
                            operation: [
                                "relateCompanies"
                            ]
                        }
                    }
                },
                {
                    displayName: "Body",
                    name: "bodyJson",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Raw request body",
                    displayOptions: {
                        show: {
                            resource: [
                                "administrators"
                            ],
                            operation: [
                                "relateCompanies"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Administrator ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "administrators"
                            ],
                            operation: [
                                "unrelateCompanies"
                            ]
                        }
                    }
                },
                {
                    displayName: "Body",
                    name: "bodyJson",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Raw request body",
                    displayOptions: {
                        show: {
                            resource: [
                                "administrators"
                            ],
                            operation: [
                                "unrelateCompanies"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Administrator ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "administrators"
                            ],
                            operation: [
                                "updateAdministrator"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "administrators"
                            ],
                            operation: [
                                "updateAdministrator"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Address",
                            name: "address",
                            type: "string",
                            default: "",
                            description: "Postal address"
                        },
                        {
                            displayName: "City",
                            name: "city",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Country",
                            name: "country",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Date Created",
                            name: "dateCreated",
                            type: "string",
                            default: "",
                            description: "Date the administrator record was created"
                        },
                        {
                            displayName: "Date Modified",
                            name: "dateModified",
                            type: "string",
                            default: "",
                            description: "Date the administrator record was last modified"
                        },
                        {
                            displayName: "Email",
                            name: "email",
                            type: "string",
                            default: "",
                            description: "Email address",
                            placeholder: "name@email.com"
                        },
                        {
                            displayName: "Embedded",
                            name: "_embedded",
                            type: "collection",
                            default: {},
                            placeholder: "Add Field",
                            options: [
                                {
                                    displayName: "Companies",
                                    name: "companies",
                                    type: "json",
                                    default: [],
                                    description: "List of companies that an administrator can access"
                                }
                            ],
                            description: "Administratorembedded"
                        },
                        {
                            displayName: "First Name",
                            name: "firstName",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "ID (Body)",
                            name: "idBody",
                            type: "number",
                            default: 0,
                            description: "Administrator ID"
                        },
                        {
                            displayName: "Language",
                            name: "language",
                            type: "options",
                            default: "es",
                            description: "Language used in the hrider interface",
                            options: [
                                {
                                    name: "Ca",
                                    value: "ca"
                                },
                                {
                                    name: "De",
                                    value: "de"
                                },
                                {
                                    name: "En",
                                    value: "en"
                                },
                                {
                                    name: "Es",
                                    value: "es"
                                },
                                {
                                    name: "Fr",
                                    value: "fr"
                                },
                                {
                                    name: "It",
                                    value: "it"
                                },
                                {
                                    name: "Pt",
                                    value: "pt"
                                }
                            ]
                        },
                        {
                            displayName: "Last Name",
                            name: "lastName",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Links",
                            name: "_links",
                            type: "collection",
                            default: {},
                            placeholder: "Add Field",
                            options: [
                                {
                                    displayName: "Change Password",
                                    name: "changePassword",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Companies",
                                    name: "companies",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Self",
                                    name: "self",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                }
                            ],
                            description: "Administratorlinks"
                        },
                        {
                            displayName: "National ID",
                            name: "nationalId",
                            type: "string",
                            default: "",
                            description: "Administrator national identification number"
                        },
                        {
                            displayName: "Organization",
                            name: "organization",
                            type: "string",
                            default: "",
                            description: "Organization name"
                        },
                        {
                            displayName: "Phone",
                            name: "phone",
                            type: "string",
                            default: "",
                            description: "Phone number"
                        },
                        {
                            displayName: "Postal Code",
                            name: "postalCode",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Update Password",
                            name: "updatePassword",
                            type: "boolean",
                            default: false,
                            description: "Whether set to `true` to update the administrator password"
                        }
                    ]
                },
                {
                    displayName: "Output",
                    name: "outputMode",
                    type: "options",
                    default: "simplified",
                    description: "Choose whether to return useful fields, the raw response, or selected fields",
                    displayOptions: {
                        show: {
                            resource: [
                                "administrators"
                            ],
                            operation: [
                                "updateAdministrator"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Raw",
                            value: "raw",
                            description: "Return the complete API response"
                        },
                        {
                            name: "Selected Fields",
                            value: "selected",
                            description: "Return only selected fields"
                        },
                        {
                            name: "Simplified",
                            value: "simplified",
                            description: "Return up to 10 useful fields"
                        }
                    ]
                },
                {
                    displayName: "Fields to Include",
                    name: "selectedFields",
                    type: "multiOptions",
                    default: [
                        "id",
                        "email",
                        "address",
                        "city",
                        "country",
                        "dateCreated",
                        "dateModified",
                        "firstName",
                        "language",
                        "lastName"
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "administrators"
                            ],
                            operation: [
                                "updateAdministrator"
                            ],
                            outputMode: [
                                "selected"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Address",
                            value: "address"
                        },
                        {
                            name: "City",
                            value: "city"
                        },
                        {
                            name: "Country",
                            value: "country"
                        },
                        {
                            name: "DateCreated",
                            value: "dateCreated"
                        },
                        {
                            name: "DateModified",
                            value: "dateModified"
                        },
                        {
                            name: "Email",
                            value: "email"
                        },
                        {
                            name: "Embedded",
                            value: "_embedded"
                        },
                        {
                            name: "FirstName",
                            value: "firstName"
                        },
                        {
                            name: "ID",
                            value: "id"
                        },
                        {
                            name: "Language",
                            value: "language"
                        },
                        {
                            name: "LastName",
                            value: "lastName"
                        },
                        {
                            name: "Links",
                            value: "_links"
                        },
                        {
                            name: "NationalId",
                            value: "nationalId"
                        },
                        {
                            name: "Organization",
                            value: "organization"
                        },
                        {
                            name: "Phone",
                            value: "phone"
                        },
                        {
                            name: "PostalCode",
                            value: "postalCode"
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ]
                        }
                    },
                    default: "getAppraisal",
                    options: [
                        {
                            name: "Download Employee Feedback Report",
                            value: "getFeedbackReport",
                            action: "Download employee feedback report appraisals",
                            description: "Retrieve an employee's feedback report for an appraisal. set `alt` or `accept` to `application/pdf` for a pdf; otherwise, the response is a file resource."
                        },
                        {
                            name: "Download Evaluator Responses",
                            value: "getFeedbackDatabaseResponses",
                            action: "Download evaluator responses appraisals",
                            description: "Download each evaluator's responses for each evaluated employee and indicator in CSV format. appraisals."
                        },
                        {
                            name: "Download Feedback Action Plan Report",
                            value: "getFeedbackActionPlanReport",
                            action: "Download feedback action plan report appraisals",
                            description: "Download the action plan report as CSV (default) or excel. set `accept` to `text/CSV` or `application/vnd.ms-excel`. appraisals."
                        },
                        {
                            name: "Download Feedback Comments Report",
                            value: "getFeedbackCommentsReport",
                            action: "Download feedback comments report appraisals",
                            description: "Download the feedback comments and open questions report as CSV (default) or excel. set `accept` to `text/CSV` or `application/vnd.ms-excel`. appraisals."
                        },
                        {
                            name: "Download Feedback Detail By Group",
                            value: "getFeedbackGroupDetailReport",
                            action: "Download feedback detail by group appraisals",
                            description: "Download the feedback detail by group report as CSV (default) or excel. set `accept` to `text/CSV` or `application/vnd.ms-excel`. appraisals."
                        },
                        {
                            name: "Download Feedback Detail Report",
                            value: "getFeedbackDetailReport",
                            action: "Download feedback detail report appraisals",
                            description: "Download the feedback detail report as CSV (default) or excel. set `accept` to `text/CSV` or `application/vnd.ms-excel`. appraisals."
                        },
                        {
                            name: "Download Feedback Results By Age",
                            value: "getFeedbackResultsAgeReport",
                            action: "Download feedback results by age appraisals",
                            description: "Download feedback results by age as CSV (default) or excel. set `accept` to `text/CSV` or `application/vnd.ms-excel`. appraisals."
                        },
                        {
                            name: "Download Feedback Results By Gender",
                            value: "getFeedbackResultsGenderReport",
                            action: "Download feedback results by gender appraisals",
                            description: "Download feedback results by gender as CSV (default) or excel. set `accept` to `text/CSV` or `application/vnd.ms-excel`. appraisals."
                        },
                        {
                            name: "Download Feedback Results By Job Position",
                            value: "getFeedbackResultsJobsReport",
                            action: "Download feedback results by job position appraisals",
                            description: "Download feedback results by job position as CSV (default) or excel. set `accept` to `text/CSV` or `application/vnd.ms-excel`. appraisals."
                        },
                        {
                            name: "Download Feedback Results By Tenure",
                            value: "getFeedbackResultsAntiquityReport",
                            action: "Download feedback results by tenure appraisals",
                            description: "Download feedback results by length of service as CSV (default) or excel. set `accept` to `text/CSV` or `application/vnd.ms-excel`. appraisals."
                        },
                        {
                            name: "Download Feedback Results Report",
                            value: "getFeedbackResultsReport",
                            action: "Download feedback results report appraisals",
                            description: "Download feedback results as CSV (default) or excel. set `accept` to `text/CSV` or `application/vnd.ms-excel`. appraisals."
                        },
                        {
                            name: "Download Full Working Environment Report",
                            value: "getWorkingEnvAllReport",
                            action: "Download full working environment report appraisals",
                            description: "Download the full working environment report as an excel workbook with separate sheets for department, position, age and gender, length of service, indicator groups, and indicators. appraisals."
                        },
                        {
                            name: "Download NBox Results Report",
                            value: "getNBoxResultsReport",
                            action: "Download nbox results report appraisals",
                            description: "Download the nbox results report as CSV (default) or excel. set `accept` to `text/CSV` or `application/vnd.ms-excel`. appraisals."
                        },
                        {
                            name: "Download Survey List Report",
                            value: "getSurveyListReport",
                            action: "Download survey list report appraisals",
                            description: "Download the surveys report as CSV (default) or excel. set `accept` to `text/CSV` or `application/vnd.ms-excel`. appraisals."
                        },
                        {
                            name: "Download Working Environment Feedback Report",
                            value: "getWorkingEnvironmentFeedbackReport",
                            action: "Download working environment feedback report appraisals",
                            description: "Download the pdf report of working environment comments and open questions. appraisals."
                        },
                        {
                            name: "Download Working Environment Report",
                            value: "getWorkingEnvironmentReport",
                            action: "Download working environment report appraisals",
                            description: "Download the pdf working environment report. appraisals."
                        },
                        {
                            name: "Download Working Environment Results By Age,Gender",
                            value: "getWorkingEnvAgeGenderReport",
                            action: "Download working environment results by age gender appraisals",
                            description: "Download working environment results by age and gender as CSV (default) or excel. set `accept` to `text/CSV` or `application/vnd.ms-excel`. appraisals."
                        },
                        {
                            name: "Download Working Environment Results By Department",
                            value: "getWorkingEnvDeptsReport",
                            action: "Download working environment results by department appraisals",
                            description: "Download working environment results by department as CSV (default) or excel. set `accept` to `text/CSV` or `application/vnd.ms-excel`. appraisals."
                        },
                        {
                            name: "Download Working Environment Results By Indicator",
                            value: "getWorkingEnvGroupsReport",
                            action: "Download working environment results by indicator appraisals",
                            description: "Download working environment results by indicator group as CSV (default) or excel. set `accept` to `text/CSV` or `application/vnd.ms-excel`. appraisals."
                        },
                        {
                            name: "Download Working Environment Results By Indicator (20)",
                            value: "getWorkingEnvIndicatorsReport",
                            action: "Download working environment results by indicator appraisals",
                            description: "Download working environment results by indicator as CSV (default) or excel. set `accept` to `text/CSV` or `application/vnd.ms-excel`. appraisals."
                        },
                        {
                            name: "Download Working Environment Results By Tenure",
                            value: "getWorkingEnvAntiquityReport",
                            action: "Download working environment results by tenure appraisals",
                            description: "Download working environment results by length of service as CSV (default) or excel. set `accept` to `text/CSV` or `application/vnd.ms-excel`. appraisals."
                        },
                        {
                            name: "Download Working Environment Results Job Position",
                            value: "getWorkingEnvJobsReport",
                            action: "Download working environment results job position appraisals",
                            description: "Download working environment results by job position as CSV (default) or excel. set `accept` to `text/CSV` or `application/vnd.ms-excel`. appraisals."
                        },
                        {
                            name: "Get",
                            value: "getAppraisal",
                            action: "Get appraisal",
                            description: "Retrieve an appraisal by company and appraisal ID"
                        },
                        {
                            name: "Get Invitation",
                            value: "getInvitation",
                            action: "Get invitation appraisals",
                            description: "Retrieve an employee's invitation to an appraisal"
                        },
                        {
                            name: "List",
                            value: "getAppraisals",
                            action: "List appraisals",
                            description: "List appraisals for a company. filter by page, name or code text, and start-date range."
                        },
                        {
                            name: "List Feedback Reports",
                            value: "getFeedbackReports",
                            action: "List feedback reports appraisals",
                            description: "List feedback reports for an appraisal"
                        },
                        {
                            name: "List Invitations",
                            value: "getInvitations",
                            action: "List invitations appraisals",
                            description: "List invitations for an appraisal"
                        },
                        {
                            name: "List Reports",
                            value: "getReports",
                            action: "List reports appraisals",
                            description: "List reports available for an appraisal. available report types depend on the appraisal type and status."
                        },
                        {
                            name: "Resend Appraisal Invitation",
                            value: "resendInvitation",
                            action: "Resend appraisal invitation",
                            description: "Resend an appraisal invitation to an employee"
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getAppraisal"
                            ]
                        }
                    }
                },
                {
                    displayName: "Appraisal ID",
                    name: "appraisalId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getAppraisal"
                            ]
                        }
                    }
                },
                {
                    displayName: "Output",
                    name: "outputMode",
                    type: "options",
                    default: "simplified",
                    description: "Choose whether to return useful fields, the raw response, or selected fields",
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getAppraisal"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Raw",
                            value: "raw",
                            description: "Return the complete API response"
                        },
                        {
                            name: "Selected Fields",
                            value: "selected",
                            description: "Return only selected fields"
                        },
                        {
                            name: "Simplified",
                            value: "simplified",
                            description: "Return up to 10 useful fields"
                        }
                    ]
                },
                {
                    displayName: "Fields to Include",
                    name: "selectedFields",
                    type: "multiOptions",
                    default: [
                        "id",
                        "type",
                        "description",
                        "code",
                        "companyId",
                        "dateCreated",
                        "dateModified",
                        "endDate",
                        "reviewOpened",
                        "startDate"
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getAppraisal"
                            ],
                            outputMode: [
                                "selected"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Code",
                            value: "code"
                        },
                        {
                            name: "CompanyId",
                            value: "companyId"
                        },
                        {
                            name: "DateCreated",
                            value: "dateCreated"
                        },
                        {
                            name: "DateModified",
                            value: "dateModified"
                        },
                        {
                            name: "Description",
                            value: "description"
                        },
                        {
                            name: "Embedded",
                            value: "_embedded"
                        },
                        {
                            name: "EndDate",
                            value: "endDate"
                        },
                        {
                            name: "FeedbackInfo",
                            value: "feedbackInfo"
                        },
                        {
                            name: "ID",
                            value: "id"
                        },
                        {
                            name: "Links",
                            value: "_links"
                        },
                        {
                            name: "NboxInfo",
                            value: "nboxInfo"
                        },
                        {
                            name: "ReviewOpened",
                            value: "reviewOpened"
                        },
                        {
                            name: "StartDate",
                            value: "startDate"
                        },
                        {
                            name: "State",
                            value: "state"
                        },
                        {
                            name: "Type",
                            value: "type"
                        },
                        {
                            name: "WorkEnvironmentInfo",
                            value: "workEnvironmentInfo"
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getAppraisals"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getAppraisals"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Page",
                            name: "page",
                            type: "number",
                            default: 0,
                            description: "Page number to retrieve"
                        },
                        {
                            displayName: "Page Size",
                            name: "pageSize",
                            type: "number",
                            default: 0,
                            description: "Number of results to return per page"
                        },
                        {
                            displayName: "Start Date Maximum",
                            name: "startDateMaximum",
                            type: "string",
                            default: "",
                            description: "Include appraisals starting on or before this date"
                        },
                        {
                            displayName: "Start Date Minimum",
                            name: "startDateMinimum",
                            type: "string",
                            default: "",
                            description: "Include appraisals starting on or after this date"
                        },
                        {
                            displayName: "Text Search",
                            name: "textSearch",
                            type: "string",
                            default: "",
                            description: "Filter appraisals by text in the name or code"
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackActionPlanReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Appraisal ID",
                    name: "appraisalId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackActionPlanReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackActionPlanReport"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Accept",
                            name: "accept",
                            type: "string",
                            default: "",
                            description: "Preferred report format: `text/CSV` or `application/vnd.ms-excel`. CSV is the default."
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackCommentsReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Appraisal ID",
                    name: "appraisalId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackCommentsReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackCommentsReport"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Accept",
                            name: "accept",
                            type: "string",
                            default: "",
                            description: "Preferred report format: `text/CSV` or `application/vnd.ms-excel`. CSV is the default."
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackDatabaseResponses"
                            ]
                        }
                    }
                },
                {
                    displayName: "Appraisal ID",
                    name: "appraisalId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackDatabaseResponses"
                            ]
                        }
                    }
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackDetailReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Appraisal ID",
                    name: "appraisalId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackDetailReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackDetailReport"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Accept",
                            name: "accept",
                            type: "string",
                            default: "",
                            description: "Preferred report format: `text/CSV` or `application/vnd.ms-excel`. CSV is the default."
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackGroupDetailReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Appraisal ID",
                    name: "appraisalId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackGroupDetailReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackGroupDetailReport"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Accept",
                            name: "accept",
                            type: "string",
                            default: "",
                            description: "Preferred report format: `text/CSV` or `application/vnd.ms-excel`. CSV is the default."
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Appraisal ID",
                    name: "appraisalId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Employee ID",
                    name: "employeeId",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Employee ID. for an external employee ID, use the `externalid=` prefix.",
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackReport"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Accept",
                            name: "accept",
                            type: "string",
                            default: "",
                            description: "Set to `application/pdf` to return the pdf report"
                        },
                        {
                            displayName: "Alt",
                            name: "alt",
                            type: "string",
                            default: "",
                            description: "Set to `application/pdf` to return the pdf report"
                        }
                    ]
                },
                {
                    displayName: "Output",
                    name: "outputMode",
                    type: "options",
                    default: "simplified",
                    description: "Choose whether to return useful fields, the raw response, or selected fields",
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackReport"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Raw",
                            value: "raw",
                            description: "Return the complete API response"
                        },
                        {
                            name: "Selected Fields",
                            value: "selected",
                            description: "Return only selected fields"
                        },
                        {
                            name: "Simplified",
                            value: "simplified",
                            description: "Return up to 10 useful fields"
                        }
                    ]
                },
                {
                    displayName: "Fields to Include",
                    name: "selectedFields",
                    type: "multiOptions",
                    default: [
                        "age",
                        "gap",
                        "gender",
                        "grade",
                        "hasReport",
                        "percentageAchievedCompetences",
                        "percentageAchievedIndicators",
                        "percentageAchievedObjectives",
                        "positionCode",
                        "positionId"
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackReport"
                            ],
                            outputMode: [
                                "selected"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Age",
                            value: "age"
                        },
                        {
                            name: "Embedded",
                            value: "_embedded"
                        },
                        {
                            name: "Gap",
                            value: "gap"
                        },
                        {
                            name: "Gender",
                            value: "gender"
                        },
                        {
                            name: "Grade",
                            value: "grade"
                        },
                        {
                            name: "HasReport",
                            value: "hasReport"
                        },
                        {
                            name: "Links",
                            value: "_links"
                        },
                        {
                            name: "PercentageAchievedCompetences",
                            value: "percentageAchievedCompetences"
                        },
                        {
                            name: "PercentageAchievedIndicators",
                            value: "percentageAchievedIndicators"
                        },
                        {
                            name: "PercentageAchievedObjectives",
                            value: "percentageAchievedObjectives"
                        },
                        {
                            name: "PositionCode",
                            value: "positionCode"
                        },
                        {
                            name: "PositionId",
                            value: "positionId"
                        },
                        {
                            name: "Review",
                            value: "review"
                        },
                        {
                            name: "Score",
                            value: "score"
                        },
                        {
                            name: "Seniority",
                            value: "seniority"
                        },
                        {
                            name: "Surveys",
                            value: "surveys"
                        },
                        {
                            name: "SurveysCompleted",
                            value: "surveysCompleted"
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackReports"
                            ]
                        }
                    }
                },
                {
                    displayName: "Appraisal ID",
                    name: "appraisalId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackReports"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackReports"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Page",
                            name: "page",
                            type: "number",
                            default: 0,
                            description: "Page number to retrieve"
                        },
                        {
                            displayName: "Page Size",
                            name: "pageSize",
                            type: "number",
                            default: 0,
                            description: "Number of results to return per page"
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackResultsAgeReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Appraisal ID",
                    name: "appraisalId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackResultsAgeReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackResultsAgeReport"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Accept",
                            name: "accept",
                            type: "string",
                            default: "",
                            description: "Preferred report format: `text/CSV` or `application/vnd.ms-excel`. CSV is the default."
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackResultsAntiquityReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Appraisal ID",
                    name: "appraisalId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackResultsAntiquityReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackResultsAntiquityReport"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Accept",
                            name: "accept",
                            type: "string",
                            default: "",
                            description: "Preferred report format: `text/CSV` or `application/vnd.ms-excel`. CSV is the default."
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackResultsGenderReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Appraisal ID",
                    name: "appraisalId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackResultsGenderReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackResultsGenderReport"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Accept",
                            name: "accept",
                            type: "string",
                            default: "",
                            description: "Preferred report format: `text/CSV` or `application/vnd.ms-excel`. CSV is the default."
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackResultsJobsReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Appraisal ID",
                    name: "appraisalId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackResultsJobsReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackResultsJobsReport"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Accept",
                            name: "accept",
                            type: "string",
                            default: "",
                            description: "Preferred report format: `text/CSV` or `application/vnd.ms-excel`. CSV is the default."
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackResultsReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Appraisal ID",
                    name: "appraisalId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackResultsReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getFeedbackResultsReport"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Accept",
                            name: "accept",
                            type: "string",
                            default: "",
                            description: "Preferred report format: `text/CSV` or `application/vnd.ms-excel`. CSV is the default."
                        },
                        {
                            displayName: "Include Groups Scores",
                            name: "includeGroupsScores",
                            type: "boolean",
                            default: true,
                            description: "Whether set to `true` to include a score for each indicator group"
                        },
                        {
                            displayName: "Include Role Scores",
                            name: "includeRoleScores",
                            type: "boolean",
                            default: false,
                            description: "Whether set to `true` to include a score for each evaluator role"
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getInvitation"
                            ]
                        }
                    }
                },
                {
                    displayName: "Appraisal ID",
                    name: "appraisalId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getInvitation"
                            ]
                        }
                    }
                },
                {
                    displayName: "Employee ID",
                    name: "employeeId",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Employee ID. for an external employee ID, use the `externalid=` prefix.",
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getInvitation"
                            ]
                        }
                    }
                },
                {
                    displayName: "Output",
                    name: "outputMode",
                    type: "options",
                    default: "simplified",
                    description: "Choose whether to return useful fields, the raw response, or selected fields",
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getInvitation"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Raw",
                            value: "raw",
                            description: "Return the complete API response"
                        },
                        {
                            name: "Selected Fields",
                            value: "selected",
                            description: "Return only selected fields"
                        },
                        {
                            name: "Simplified",
                            value: "simplified",
                            description: "Return up to 10 useful fields"
                        }
                    ]
                },
                {
                    displayName: "Fields to Include",
                    name: "selectedFields",
                    type: "multiOptions",
                    default: [
                        "accessCode",
                        "deadlineDate",
                        "emailReadDate",
                        "emailStatus",
                        "errorMessage",
                        "key",
                        "lastEmailDate",
                        "lastReviewEmailDate",
                        "nextEmailDate",
                        "nextReviewEmailDate"
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getInvitation"
                            ],
                            outputMode: [
                                "selected"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "AccessCode",
                            value: "accessCode"
                        },
                        {
                            name: "DeadlineDate",
                            value: "deadlineDate"
                        },
                        {
                            name: "EmailReadDate",
                            value: "emailReadDate"
                        },
                        {
                            name: "EmailStatus",
                            value: "emailStatus"
                        },
                        {
                            name: "Embedded",
                            value: "_embedded"
                        },
                        {
                            name: "ErrorMessage",
                            value: "errorMessage"
                        },
                        {
                            name: "Key",
                            value: "key"
                        },
                        {
                            name: "LastEmailDate",
                            value: "lastEmailDate"
                        },
                        {
                            name: "LastReviewEmailDate",
                            value: "lastReviewEmailDate"
                        },
                        {
                            name: "Links",
                            value: "_links"
                        },
                        {
                            name: "NextEmailDate",
                            value: "nextEmailDate"
                        },
                        {
                            name: "NextReviewEmailDate",
                            value: "nextReviewEmailDate"
                        },
                        {
                            name: "ReviewEmailReadDate",
                            value: "reviewEmailReadDate"
                        },
                        {
                            name: "ReviewEmailStatus",
                            value: "reviewEmailStatus"
                        },
                        {
                            name: "State",
                            value: "state"
                        },
                        {
                            name: "SurveysAsSupervisorNumber",
                            value: "surveysAsSupervisorNumber"
                        },
                        {
                            name: "SurveysCompleted",
                            value: "surveysCompleted"
                        },
                        {
                            name: "SurveysNumber",
                            value: "surveysNumber"
                        },
                        {
                            name: "SurveysReviewedNumber",
                            value: "surveysReviewedNumber"
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getInvitations"
                            ]
                        }
                    }
                },
                {
                    displayName: "Appraisal ID",
                    name: "appraisalId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getInvitations"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getInvitations"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Page",
                            name: "page",
                            type: "number",
                            default: 0,
                            description: "Page number to retrieve"
                        },
                        {
                            displayName: "Page Size",
                            name: "pageSize",
                            type: "number",
                            default: 0,
                            description: "Number of results to return per page"
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getNBoxResultsReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Appraisal ID",
                    name: "appraisalId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getNBoxResultsReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getNBoxResultsReport"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Accept",
                            name: "accept",
                            type: "string",
                            default: "",
                            description: "Preferred report format: `text/CSV` or `application/vnd.ms-excel`. CSV is the default."
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getReports"
                            ]
                        }
                    }
                },
                {
                    displayName: "Appraisal ID",
                    name: "appraisalId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getReports"
                            ]
                        }
                    }
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getSurveyListReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Appraisal ID",
                    name: "appraisalId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getSurveyListReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getSurveyListReport"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Accept",
                            name: "accept",
                            type: "string",
                            default: "",
                            description: "Preferred report format: `text/CSV` or `application/vnd.ms-excel`. CSV is the default."
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getWorkingEnvAgeGenderReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Appraisal ID",
                    name: "appraisalId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getWorkingEnvAgeGenderReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getWorkingEnvAgeGenderReport"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Accept",
                            name: "accept",
                            type: "string",
                            default: "",
                            description: "Preferred report format: `text/CSV` or `application/vnd.ms-excel`. CSV is the default."
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getWorkingEnvAllReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Appraisal ID",
                    name: "appraisalId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getWorkingEnvAllReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getWorkingEnvAntiquityReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Appraisal ID",
                    name: "appraisalId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getWorkingEnvAntiquityReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getWorkingEnvAntiquityReport"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Accept",
                            name: "accept",
                            type: "string",
                            default: "",
                            description: "Preferred report format: `text/CSV` or `application/vnd.ms-excel`. CSV is the default."
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getWorkingEnvDeptsReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Appraisal ID",
                    name: "appraisalId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getWorkingEnvDeptsReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getWorkingEnvDeptsReport"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Accept",
                            name: "accept",
                            type: "string",
                            default: "",
                            description: "Preferred report format: `text/CSV` or `application/vnd.ms-excel`. CSV is the default."
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getWorkingEnvGroupsReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Appraisal ID",
                    name: "appraisalId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getWorkingEnvGroupsReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getWorkingEnvGroupsReport"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Accept",
                            name: "accept",
                            type: "string",
                            default: "",
                            description: "Preferred report format: `text/CSV` or `application/vnd.ms-excel`. CSV is the default."
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getWorkingEnvIndicatorsReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Appraisal ID",
                    name: "appraisalId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getWorkingEnvIndicatorsReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getWorkingEnvIndicatorsReport"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Accept",
                            name: "accept",
                            type: "string",
                            default: "",
                            description: "Preferred report format: `text/CSV` or `application/vnd.ms-excel`. CSV is the default."
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getWorkingEnvJobsReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Appraisal ID",
                    name: "appraisalId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getWorkingEnvJobsReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getWorkingEnvJobsReport"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Accept",
                            name: "accept",
                            type: "string",
                            default: "",
                            description: "Preferred report format: `text/CSV` or `application/vnd.ms-excel`. CSV is the default."
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getWorkingEnvironmentFeedbackReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Appraisal ID",
                    name: "appraisalId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getWorkingEnvironmentFeedbackReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getWorkingEnvironmentReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Appraisal ID",
                    name: "appraisalId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "getWorkingEnvironmentReport"
                            ]
                        }
                    }
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "resendInvitation"
                            ]
                        }
                    }
                },
                {
                    displayName: "Appraisal ID",
                    name: "appraisalId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "resendInvitation"
                            ]
                        }
                    }
                },
                {
                    displayName: "Employee ID",
                    name: "employeeId",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Employee ID. for an external employee ID, use the `externalid=` prefix.",
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "resendInvitation"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "appraisals"
                            ],
                            operation: [
                                "resendInvitation"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Deadline Date",
                            name: "deadlineDate",
                            type: "string",
                            default: "",
                            description: "Invitation deadline date"
                        },
                        {
                            displayName: "Send Date",
                            name: "sendDate",
                            type: "string",
                            default: "",
                            description: "Invitation send date"
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "companies"
                            ]
                        }
                    },
                    default: "createCompany",
                    options: [
                        {
                            name: "Assign Administrators To",
                            value: "relateAdministrators",
                            action: "Assign administrators to company",
                            description: "Assign one or more administrators to a company using a `text/URI-list`"
                        },
                        {
                            name: "Create",
                            value: "createCompany",
                            action: "Create company",
                            description: "Create a company"
                        },
                        {
                            name: "Delete",
                            value: "deleteCompany",
                            action: "Delete company",
                            description: "Delete a company"
                        },
                        {
                            name: "Delete Company Logo",
                            value: "deleteCompanyLogo",
                            action: "Delete company logo",
                            description: "Delete a company's logo"
                        },
                        {
                            name: "Get",
                            value: "getCompany",
                            action: "Get company",
                            description: "Retrieve a company by ID"
                        },
                        {
                            name: "Get Company Logo",
                            value: "getCompanyLogo",
                            action: "Get company logo",
                            description: "Retrieve a company's logo. set `alt` to `media` or request an `image/*` response to return image content; otherwise, the response is a file resource."
                        },
                        {
                            name: "List",
                            value: "getCompanies_1",
                            action: "List companies",
                            description: "List companies. use `administratorid` to filter for companies assigned to an administrator."
                        },
                        {
                            name: "List Company Administrators",
                            value: "getAdministrators_1",
                            action: "List company administrators",
                            description: "List administrators assigned to a company"
                        },
                        {
                            name: "Remove Company Administrators",
                            value: "unrelateAdministrators",
                            action: "Remove company administrators",
                            description: "Remove one or more administrator assignments from a company using a `text/URI-list`"
                        },
                        {
                            name: "Update",
                            value: "updateCompany",
                            action: "Update company",
                            description: "Update a company's details"
                        },
                        {
                            name: "Upload Company Logo",
                            value: "setCompanyLogo",
                            action: "Upload company logo",
                            description: "Upload a company logo as multipart form data. include the image in the `data` part; the media type is read from `content-type` or the filename extension."
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "companies"
                            ],
                            operation: [
                                "createCompany"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Address",
                            name: "address",
                            type: "string",
                            default: "",
                            description: "Company address"
                        },
                        {
                            displayName: "Date Created",
                            name: "dateCreated",
                            type: "string",
                            default: "",
                            description: "Date the company was created"
                        },
                        {
                            displayName: "Date Modified",
                            name: "dateModified",
                            type: "string",
                            default: "",
                            description: "Date the company was last modified"
                        },
                        {
                            displayName: "Embedded",
                            name: "_embedded",
                            type: "collection",
                            default: {},
                            placeholder: "Add Field",
                            options: [
                                {
                                    displayName: "Administrators",
                                    name: "administrators",
                                    type: "json",
                                    default: []
                                },
                                {
                                    displayName: "Logo",
                                    name: "logo",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "ID",
                                            name: "id",
                                            type: "number",
                                            default: 0,
                                            description: "File ID"
                                        }
                                    ],
                                    description: "Simplified file object with the most important data"
                                }
                            ],
                            description: "Companyembedded"
                        },
                        {
                            displayName: "ID",
                            name: "id",
                            type: "number",
                            default: 0,
                            description: "Company ID"
                        },
                        {
                            displayName: "Language",
                            name: "language",
                            type: "options",
                            default: "es",
                            description: "Company language code",
                            options: [
                                {
                                    name: "Ca",
                                    value: "ca"
                                },
                                {
                                    name: "De",
                                    value: "de"
                                },
                                {
                                    name: "En",
                                    value: "en"
                                },
                                {
                                    name: "Es",
                                    value: "es"
                                },
                                {
                                    name: "Fr",
                                    value: "fr"
                                },
                                {
                                    name: "It",
                                    value: "it"
                                },
                                {
                                    name: "Pt",
                                    value: "pt"
                                }
                            ]
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Links",
                            name: "_links",
                            type: "collection",
                            default: {},
                            placeholder: "Add Field",
                            options: [
                                {
                                    displayName: "Administrators",
                                    name: "administrators",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ]
                                },
                                {
                                    displayName: "Appraisals",
                                    name: "appraisals",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Departments",
                                    name: "departments",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Employees",
                                    name: "employees",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Logo",
                                    name: "logo",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Logo Content",
                                    name: "logoContent",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Self",
                                    name: "self",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                }
                            ],
                            description: "Companylinks"
                        },
                        {
                            displayName: "Name",
                            name: "name",
                            type: "string",
                            default: "",
                            description: "Company name"
                        },
                        {
                            displayName: "State",
                            name: "state",
                            type: "options",
                            default: "active",
                            description: "Company status",
                            options: [
                                {
                                    name: "Active",
                                    value: "active"
                                },
                                {
                                    name: "Locked",
                                    value: "locked"
                                }
                            ]
                        },
                        {
                            displayName: "Tax ID Number",
                            name: "taxIdNumber",
                            type: "string",
                            default: "",
                            description: "Company tax identification number"
                        },
                        {
                            displayName: "Time Zone",
                            name: "timeZone",
                            type: "string",
                            default: "",
                            description: "Company time zone"
                        },
                        {
                            displayName: "Used",
                            name: "used",
                            type: "number",
                            default: 0,
                            description: "Number of employee licenses currently in use"
                        }
                    ]
                },
                {
                    displayName: "Output",
                    name: "outputMode",
                    type: "options",
                    default: "simplified",
                    description: "Choose whether to return useful fields, the raw response, or selected fields",
                    displayOptions: {
                        show: {
                            resource: [
                                "companies"
                            ],
                            operation: [
                                "createCompany"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Raw",
                            value: "raw",
                            description: "Return the complete API response"
                        },
                        {
                            name: "Selected Fields",
                            value: "selected",
                            description: "Return only selected fields"
                        },
                        {
                            name: "Simplified",
                            value: "simplified",
                            description: "Return up to 10 useful fields"
                        }
                    ]
                },
                {
                    displayName: "Fields to Include",
                    name: "selectedFields",
                    type: "multiOptions",
                    default: [
                        "id",
                        "name",
                        "address",
                        "dateCreated",
                        "dateModified",
                        "language",
                        "limit",
                        "state",
                        "taxIdNumber",
                        "timeZone"
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "companies"
                            ],
                            operation: [
                                "createCompany"
                            ],
                            outputMode: [
                                "selected"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Address",
                            value: "address"
                        },
                        {
                            name: "DateCreated",
                            value: "dateCreated"
                        },
                        {
                            name: "DateModified",
                            value: "dateModified"
                        },
                        {
                            name: "Embedded",
                            value: "_embedded"
                        },
                        {
                            name: "ID",
                            value: "id"
                        },
                        {
                            name: "Language",
                            value: "language"
                        },
                        {
                            name: "Limit",
                            value: "limit"
                        },
                        {
                            name: "Links",
                            value: "_links"
                        },
                        {
                            name: "Name",
                            value: "name"
                        },
                        {
                            name: "State",
                            value: "state"
                        },
                        {
                            name: "TaxIdNumber",
                            value: "taxIdNumber"
                        },
                        {
                            name: "TimeZone",
                            value: "timeZone"
                        },
                        {
                            name: "Used",
                            value: "used"
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Company ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "companies"
                            ],
                            operation: [
                                "deleteCompany"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Company ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "companies"
                            ],
                            operation: [
                                "deleteCompanyLogo"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Company ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "companies"
                            ],
                            operation: [
                                "getAdministrators_1"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "companies"
                            ],
                            operation: [
                                "getCompanies_1"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Administrator ID",
                            name: "administratorId",
                            type: "number",
                            default: 0,
                            description: "Filter for companies assigned to this administrator ID"
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Company ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "companies"
                            ],
                            operation: [
                                "getCompany"
                            ]
                        }
                    }
                },
                {
                    displayName: "Output",
                    name: "outputMode",
                    type: "options",
                    default: "simplified",
                    description: "Choose whether to return useful fields, the raw response, or selected fields",
                    displayOptions: {
                        show: {
                            resource: [
                                "companies"
                            ],
                            operation: [
                                "getCompany"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Raw",
                            value: "raw",
                            description: "Return the complete API response"
                        },
                        {
                            name: "Selected Fields",
                            value: "selected",
                            description: "Return only selected fields"
                        },
                        {
                            name: "Simplified",
                            value: "simplified",
                            description: "Return up to 10 useful fields"
                        }
                    ]
                },
                {
                    displayName: "Fields to Include",
                    name: "selectedFields",
                    type: "multiOptions",
                    default: [
                        "id",
                        "name",
                        "address",
                        "dateCreated",
                        "dateModified",
                        "language",
                        "limit",
                        "state",
                        "taxIdNumber",
                        "timeZone"
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "companies"
                            ],
                            operation: [
                                "getCompany"
                            ],
                            outputMode: [
                                "selected"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Address",
                            value: "address"
                        },
                        {
                            name: "DateCreated",
                            value: "dateCreated"
                        },
                        {
                            name: "DateModified",
                            value: "dateModified"
                        },
                        {
                            name: "Embedded",
                            value: "_embedded"
                        },
                        {
                            name: "ID",
                            value: "id"
                        },
                        {
                            name: "Language",
                            value: "language"
                        },
                        {
                            name: "Limit",
                            value: "limit"
                        },
                        {
                            name: "Links",
                            value: "_links"
                        },
                        {
                            name: "Name",
                            value: "name"
                        },
                        {
                            name: "State",
                            value: "state"
                        },
                        {
                            name: "TaxIdNumber",
                            value: "taxIdNumber"
                        },
                        {
                            name: "TimeZone",
                            value: "timeZone"
                        },
                        {
                            name: "Used",
                            value: "used"
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Company ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "companies"
                            ],
                            operation: [
                                "getCompanyLogo"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "companies"
                            ],
                            operation: [
                                "getCompanyLogo"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Accept",
                            name: "accept",
                            type: "string",
                            default: "",
                            description: "Request an `image/*` media type to return file content"
                        },
                        {
                            displayName: "Alt",
                            name: "alt",
                            type: "string",
                            default: "",
                            description: "Set to `media` to return file content instead of file metadata"
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Company ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "companies"
                            ],
                            operation: [
                                "relateAdministrators"
                            ]
                        }
                    }
                },
                {
                    displayName: "Body",
                    name: "bodyJson",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Raw request body",
                    displayOptions: {
                        show: {
                            resource: [
                                "companies"
                            ],
                            operation: [
                                "relateAdministrators"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Company ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "companies"
                            ],
                            operation: [
                                "setCompanyLogo"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "companies"
                            ],
                            operation: [
                                "setCompanyLogo"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Data",
                            name: "data",
                            type: "json",
                            default: {},
                            description: "Image file to upload"
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Company ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "companies"
                            ],
                            operation: [
                                "unrelateAdministrators"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "companies"
                            ],
                            operation: [
                                "unrelateAdministrators"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Body",
                            name: "bodyJson",
                            type: "string",
                            default: "",
                            description: "Raw request body"
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Company ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "companies"
                            ],
                            operation: [
                                "updateCompany"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "companies"
                            ],
                            operation: [
                                "updateCompany"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Address",
                            name: "address",
                            type: "string",
                            default: "",
                            description: "Company address"
                        },
                        {
                            displayName: "Date Created",
                            name: "dateCreated",
                            type: "string",
                            default: "",
                            description: "Date the company was created"
                        },
                        {
                            displayName: "Date Modified",
                            name: "dateModified",
                            type: "string",
                            default: "",
                            description: "Date the company was last modified"
                        },
                        {
                            displayName: "Embedded",
                            name: "_embedded",
                            type: "collection",
                            default: {},
                            placeholder: "Add Field",
                            options: [
                                {
                                    displayName: "Administrators",
                                    name: "administrators",
                                    type: "json",
                                    default: []
                                },
                                {
                                    displayName: "Logo",
                                    name: "logo",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "ID",
                                            name: "id",
                                            type: "number",
                                            default: 0,
                                            description: "File ID"
                                        }
                                    ],
                                    description: "Simplified file object with the most important data"
                                }
                            ],
                            description: "Companyembedded"
                        },
                        {
                            displayName: "ID (Body)",
                            name: "idBody",
                            type: "number",
                            default: 0,
                            description: "Company ID"
                        },
                        {
                            displayName: "Language",
                            name: "language",
                            type: "options",
                            default: "es",
                            description: "Company language code",
                            options: [
                                {
                                    name: "Ca",
                                    value: "ca"
                                },
                                {
                                    name: "De",
                                    value: "de"
                                },
                                {
                                    name: "En",
                                    value: "en"
                                },
                                {
                                    name: "Es",
                                    value: "es"
                                },
                                {
                                    name: "Fr",
                                    value: "fr"
                                },
                                {
                                    name: "It",
                                    value: "it"
                                },
                                {
                                    name: "Pt",
                                    value: "pt"
                                }
                            ]
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Links",
                            name: "_links",
                            type: "collection",
                            default: {},
                            placeholder: "Add Field",
                            options: [
                                {
                                    displayName: "Administrators",
                                    name: "administrators",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ]
                                },
                                {
                                    displayName: "Appraisals",
                                    name: "appraisals",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Departments",
                                    name: "departments",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Employees",
                                    name: "employees",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Logo",
                                    name: "logo",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Logo Content",
                                    name: "logoContent",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Self",
                                    name: "self",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                }
                            ],
                            description: "Companylinks"
                        },
                        {
                            displayName: "Name",
                            name: "name",
                            type: "string",
                            default: "",
                            description: "Company name"
                        },
                        {
                            displayName: "State",
                            name: "state",
                            type: "options",
                            default: "active",
                            description: "Company status",
                            options: [
                                {
                                    name: "Active",
                                    value: "active"
                                },
                                {
                                    name: "Locked",
                                    value: "locked"
                                }
                            ]
                        },
                        {
                            displayName: "Tax ID Number",
                            name: "taxIdNumber",
                            type: "string",
                            default: "",
                            description: "Company tax identification number"
                        },
                        {
                            displayName: "Time Zone",
                            name: "timeZone",
                            type: "string",
                            default: "",
                            description: "Company time zone"
                        },
                        {
                            displayName: "Used",
                            name: "used",
                            type: "number",
                            default: 0,
                            description: "Number of employee licenses currently in use"
                        }
                    ]
                },
                {
                    displayName: "Output",
                    name: "outputMode",
                    type: "options",
                    default: "simplified",
                    description: "Choose whether to return useful fields, the raw response, or selected fields",
                    displayOptions: {
                        show: {
                            resource: [
                                "companies"
                            ],
                            operation: [
                                "updateCompany"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Raw",
                            value: "raw",
                            description: "Return the complete API response"
                        },
                        {
                            name: "Selected Fields",
                            value: "selected",
                            description: "Return only selected fields"
                        },
                        {
                            name: "Simplified",
                            value: "simplified",
                            description: "Return up to 10 useful fields"
                        }
                    ]
                },
                {
                    displayName: "Fields to Include",
                    name: "selectedFields",
                    type: "multiOptions",
                    default: [
                        "id",
                        "name",
                        "address",
                        "dateCreated",
                        "dateModified",
                        "language",
                        "limit",
                        "state",
                        "taxIdNumber",
                        "timeZone"
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "companies"
                            ],
                            operation: [
                                "updateCompany"
                            ],
                            outputMode: [
                                "selected"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Address",
                            value: "address"
                        },
                        {
                            name: "DateCreated",
                            value: "dateCreated"
                        },
                        {
                            name: "DateModified",
                            value: "dateModified"
                        },
                        {
                            name: "Embedded",
                            value: "_embedded"
                        },
                        {
                            name: "ID",
                            value: "id"
                        },
                        {
                            name: "Language",
                            value: "language"
                        },
                        {
                            name: "Limit",
                            value: "limit"
                        },
                        {
                            name: "Links",
                            value: "_links"
                        },
                        {
                            name: "Name",
                            value: "name"
                        },
                        {
                            name: "State",
                            value: "state"
                        },
                        {
                            name: "TaxIdNumber",
                            value: "taxIdNumber"
                        },
                        {
                            name: "TimeZone",
                            value: "timeZone"
                        },
                        {
                            name: "Used",
                            value: "used"
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ]
                        }
                    },
                    default: "createDepartment",
                    options: [
                        {
                            name: "Assign Employees To Position",
                            value: "setEmployees",
                            action: "Assign employees to position departments",
                            description: "Assign one or more employees to a job position using a `text/URI-list`. departments."
                        },
                        {
                            name: "Create",
                            value: "createDepartment",
                            action: "Create department",
                            description: "Create a department"
                        },
                        {
                            name: "Create Job Position",
                            value: "createPosition",
                            action: "Create job position departments",
                            description: "Create a job position in a department"
                        },
                        {
                            name: "Delete",
                            value: "deleteDepartment",
                            action: "Delete department",
                            description: "Delete a department by ID"
                        },
                        {
                            name: "Delete Job Position",
                            value: "deletePosition",
                            action: "Delete job position departments",
                            description: "Delete a job position. departments."
                        },
                        {
                            name: "Get",
                            value: "getDepartment",
                            action: "Get department",
                            description: "Retrieve a department by ID"
                        },
                        {
                            name: "Get Job Position",
                            value: "getPosition",
                            action: "Get job position departments",
                            description: "Retrieve a job position by ID. departments."
                        },
                        {
                            name: "Get Parent",
                            value: "getParent",
                            action: "Get parent department",
                            description: "Retrieve the parent department"
                        },
                        {
                            name: "List",
                            value: "getDepartments",
                            action: "List departments",
                            description: "List departments in a company. set `parentid` to return its children; use `-1` for top-level departments."
                        },
                        {
                            name: "List Child",
                            value: "getChildren",
                            action: "List child departments",
                            description: "List child departments"
                        },
                        {
                            name: "List Job Positions",
                            value: "getPositions",
                            action: "List job positions departments",
                            description: "List job positions in a department"
                        },
                        {
                            name: "List Position Employees",
                            value: "getEmployees",
                            action: "List position employees departments",
                            description: "List employees assigned to a job position. departments."
                        },
                        {
                            name: "Move Position To",
                            value: "movePosition",
                            action: "Move position to department",
                            description: "Move a job position into the specified department using its ID or resource URI"
                        },
                        {
                            name: "Set Parent",
                            value: "setParent",
                            action: "Set parent department",
                            description: "Assign a parent department using its ID or resource URI in a `text/URI-list`"
                        },
                        {
                            name: "Unassign Employees From Position",
                            value: "deleteEmployees",
                            action: "Unassign employees from position departments",
                            description: "Unassign one or more employees from a job position using a `text/URI-list`. departments."
                        },
                        {
                            name: "Update",
                            value: "updateDepartment",
                            action: "Update department",
                            description: "Update a department's details"
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "createDepartment"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "createDepartment"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Code",
                            name: "code",
                            type: "string",
                            default: "",
                            description: "Department code"
                        },
                        {
                            displayName: "Date Created",
                            name: "dateCreated",
                            type: "string",
                            default: "",
                            description: "Date the department was created"
                        },
                        {
                            displayName: "Date Modified",
                            name: "dateModified",
                            type: "string",
                            default: "",
                            description: "Date the department was last modified"
                        },
                        {
                            displayName: "Embedded",
                            name: "_embedded",
                            type: "collection",
                            default: {},
                            placeholder: "Add Field",
                            options: [
                                {
                                    displayName: "Company",
                                    name: "company",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "ID",
                                            name: "id",
                                            type: "number",
                                            default: 0,
                                            description: "Company ID"
                                        },
                                        {
                                            displayName: "Name",
                                            name: "name",
                                            type: "string",
                                            default: "",
                                            description: "Company name"
                                        }
                                    ],
                                    description: "Simplified company object with the most important data"
                                },
                                {
                                    displayName: "Parent",
                                    name: "parent",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Code",
                                            name: "code",
                                            type: "string",
                                            default: "",
                                            description: "Department code"
                                        },
                                        {
                                            displayName: "ID",
                                            name: "id",
                                            type: "number",
                                            default: 0,
                                            description: "Department ID"
                                        },
                                        {
                                            displayName: "Name",
                                            name: "name",
                                            type: "string",
                                            default: "",
                                            description: "Department name"
                                        }
                                    ],
                                    description: "Simplified department object with the most important data"
                                },
                                {
                                    displayName: "Positions",
                                    name: "positions",
                                    type: "json",
                                    default: [],
                                    description: "List of job positions that a department has"
                                }
                            ],
                            description: "Departmentembedded"
                        },
                        {
                            displayName: "ID",
                            name: "id",
                            type: "number",
                            default: 0,
                            description: "Department ID"
                        },
                        {
                            displayName: "Links",
                            name: "_links",
                            type: "collection",
                            default: {},
                            placeholder: "Add Field",
                            options: [
                                {
                                    displayName: "Children",
                                    name: "children",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Company",
                                    name: "company",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Parent",
                                    name: "parent",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Positions",
                                    name: "positions",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Self",
                                    name: "self",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                }
                            ],
                            description: "Departmentlinks"
                        },
                        {
                            displayName: "Name",
                            name: "name",
                            type: "string",
                            default: "",
                            description: "Department name"
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "createPosition"
                            ]
                        }
                    }
                },
                {
                    displayName: "Department ID",
                    name: "departmentId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "createPosition"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "createPosition"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Code",
                            name: "code",
                            type: "string",
                            default: "",
                            description: "Job position code"
                        },
                        {
                            displayName: "Date Created",
                            name: "dateCreated",
                            type: "string",
                            default: "",
                            description: "Date the job position was created"
                        },
                        {
                            displayName: "Date Modified",
                            name: "dateModified",
                            type: "string",
                            default: "",
                            description: "Date the job position was last modified"
                        },
                        {
                            displayName: "Embedded",
                            name: "_embedded",
                            type: "collection",
                            default: {},
                            placeholder: "Add Field",
                            options: [
                                {
                                    displayName: "Department",
                                    name: "department",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Code",
                                            name: "code",
                                            type: "string",
                                            default: "",
                                            description: "Department code"
                                        },
                                        {
                                            displayName: "ID",
                                            name: "id",
                                            type: "number",
                                            default: 0,
                                            description: "Department ID"
                                        },
                                        {
                                            displayName: "Name",
                                            name: "name",
                                            type: "string",
                                            default: "",
                                            description: "Department name"
                                        }
                                    ],
                                    description: "Simplified department object with the most important data"
                                }
                            ],
                            description: "Positionembedded"
                        },
                        {
                            displayName: "Enrolled",
                            name: "enrolled",
                            type: "number",
                            default: 0,
                            description: "Number of employees assigned to the position"
                        },
                        {
                            displayName: "ID",
                            name: "id",
                            type: "number",
                            default: 0,
                            description: "Job position ID"
                        },
                        {
                            displayName: "Links",
                            name: "_links",
                            type: "collection",
                            default: {},
                            placeholder: "Add Field",
                            options: [
                                {
                                    displayName: "Department",
                                    name: "department",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Employees",
                                    name: "employees",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Move",
                                    name: "move",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Self",
                                    name: "self",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                }
                            ],
                            description: "Positionlinks"
                        },
                        {
                            displayName: "Name",
                            name: "name",
                            type: "string",
                            default: "",
                            description: "Job position name"
                        },
                        {
                            displayName: "Required",
                            name: "required",
                            type: "number",
                            default: 0,
                            description: "Number of employees needed for the position"
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "deleteDepartment"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "number",
                    default: 0,
                    required: true,
                    description: "Department ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "deleteDepartment"
                            ]
                        }
                    }
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "deleteEmployees"
                            ]
                        }
                    }
                },
                {
                    displayName: "Department ID",
                    name: "departmentId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "deleteEmployees"
                            ]
                        }
                    }
                },
                {
                    displayName: "Position ID",
                    name: "positionId",
                    type: "number",
                    default: 0,
                    required: true,
                    description: "Job position ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "deleteEmployees"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "deleteEmployees"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Body",
                            name: "bodyJson",
                            type: "string",
                            default: "",
                            description: "Raw request body"
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "deletePosition"
                            ]
                        }
                    }
                },
                {
                    displayName: "Department ID",
                    name: "departmentId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "deletePosition"
                            ]
                        }
                    }
                },
                {
                    displayName: "Position ID",
                    name: "positionId",
                    type: "number",
                    default: 0,
                    required: true,
                    description: "Job position ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "deletePosition"
                            ]
                        }
                    }
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "getChildren"
                            ]
                        }
                    }
                },
                {
                    displayName: "Department ID",
                    name: "departmentId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "getChildren"
                            ]
                        }
                    }
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "getDepartment"
                            ]
                        }
                    }
                },
                {
                    displayName: "Department ID",
                    name: "departmentId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "getDepartment"
                            ]
                        }
                    }
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "getDepartments"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "getDepartments"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Parent ID",
                            name: "parentId",
                            type: "number",
                            default: 0,
                            description: "Parent department ID. use `-1` for top-level departments."
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "getEmployees"
                            ]
                        }
                    }
                },
                {
                    displayName: "Department ID",
                    name: "departmentId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "getEmployees"
                            ]
                        }
                    }
                },
                {
                    displayName: "Position ID",
                    name: "positionId",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Job position ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "getEmployees"
                            ]
                        }
                    }
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "getParent"
                            ]
                        }
                    }
                },
                {
                    displayName: "Department ID",
                    name: "departmentId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "getParent"
                            ]
                        }
                    }
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "getPosition"
                            ]
                        }
                    }
                },
                {
                    displayName: "Department ID",
                    name: "departmentId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "getPosition"
                            ]
                        }
                    }
                },
                {
                    displayName: "Position ID",
                    name: "positionId",
                    type: "number",
                    default: 0,
                    required: true,
                    description: "Job position ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "getPosition"
                            ]
                        }
                    }
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "getPositions"
                            ]
                        }
                    }
                },
                {
                    displayName: "Department ID",
                    name: "departmentId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "getPositions"
                            ]
                        }
                    }
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "movePosition"
                            ]
                        }
                    }
                },
                {
                    displayName: "Department ID",
                    name: "departmentId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "movePosition"
                            ]
                        }
                    }
                },
                {
                    displayName: "Position ID",
                    name: "positionId",
                    type: "number",
                    default: 0,
                    required: true,
                    description: "Job position ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "movePosition"
                            ]
                        }
                    }
                },
                {
                    displayName: "Body",
                    name: "bodyJson",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Raw request body",
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "movePosition"
                            ]
                        }
                    }
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "setEmployees"
                            ]
                        }
                    }
                },
                {
                    displayName: "Department ID",
                    name: "departmentId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "setEmployees"
                            ]
                        }
                    }
                },
                {
                    displayName: "Position ID",
                    name: "positionId",
                    type: "number",
                    default: 0,
                    required: true,
                    description: "Job position ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "setEmployees"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "setEmployees"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Body",
                            name: "bodyJson",
                            type: "string",
                            default: "",
                            description: "Raw request body"
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "setParent"
                            ]
                        }
                    }
                },
                {
                    displayName: "Department ID",
                    name: "departmentId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "setParent"
                            ]
                        }
                    }
                },
                {
                    displayName: "Body",
                    name: "bodyJson",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Raw request body",
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "setParent"
                            ]
                        }
                    }
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "updateDepartment"
                            ]
                        }
                    }
                },
                {
                    displayName: "Department ID",
                    name: "departmentId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "updateDepartment"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "departments"
                            ],
                            operation: [
                                "updateDepartment"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Code",
                            name: "code",
                            type: "string",
                            default: "",
                            description: "Department code"
                        },
                        {
                            displayName: "Date Created",
                            name: "dateCreated",
                            type: "string",
                            default: "",
                            description: "Date the department was created"
                        },
                        {
                            displayName: "Date Modified",
                            name: "dateModified",
                            type: "string",
                            default: "",
                            description: "Date the department was last modified"
                        },
                        {
                            displayName: "Embedded",
                            name: "_embedded",
                            type: "collection",
                            default: {},
                            placeholder: "Add Field",
                            options: [
                                {
                                    displayName: "Company",
                                    name: "company",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "ID",
                                            name: "id",
                                            type: "number",
                                            default: 0,
                                            description: "Company ID"
                                        },
                                        {
                                            displayName: "Name",
                                            name: "name",
                                            type: "string",
                                            default: "",
                                            description: "Company name"
                                        }
                                    ],
                                    description: "Simplified company object with the most important data"
                                },
                                {
                                    displayName: "Parent",
                                    name: "parent",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Code",
                                            name: "code",
                                            type: "string",
                                            default: "",
                                            description: "Department code"
                                        },
                                        {
                                            displayName: "ID",
                                            name: "id",
                                            type: "number",
                                            default: 0,
                                            description: "Department ID"
                                        },
                                        {
                                            displayName: "Name",
                                            name: "name",
                                            type: "string",
                                            default: "",
                                            description: "Department name"
                                        }
                                    ],
                                    description: "Simplified department object with the most important data"
                                },
                                {
                                    displayName: "Positions",
                                    name: "positions",
                                    type: "json",
                                    default: [],
                                    description: "List of job positions that a department has"
                                }
                            ],
                            description: "Departmentembedded"
                        },
                        {
                            displayName: "ID",
                            name: "id",
                            type: "number",
                            default: 0,
                            description: "Department ID"
                        },
                        {
                            displayName: "Links",
                            name: "_links",
                            type: "collection",
                            default: {},
                            placeholder: "Add Field",
                            options: [
                                {
                                    displayName: "Children",
                                    name: "children",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Company",
                                    name: "company",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Parent",
                                    name: "parent",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Positions",
                                    name: "positions",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Self",
                                    name: "self",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                }
                            ],
                            description: "Departmentlinks"
                        },
                        {
                            displayName: "Name",
                            name: "name",
                            type: "string",
                            default: "",
                            description: "Department name"
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ]
                        }
                    },
                    default: "createEmployee",
                    options: [
                        {
                            name: "Archive Or Delete",
                            value: "deleteEmployee",
                            action: "Archive or delete employee",
                            description: "Archive an employee by default. set `archive` to `false` to delete the employee; archived records keep their history and no longer use a company license."
                        },
                        {
                            name: "Assign Clients To",
                            value: "setClients",
                            action: "Assign clients to employee",
                            description: "Assign clients to an employee using a `text/URI-list`"
                        },
                        {
                            name: "Assign Employee Position",
                            value: "setPosition",
                            action: "Assign employee position",
                            description: "Assign a job position to an employee using its ID or resource URI in a `text/URI-list`"
                        },
                        {
                            name: "Assign Employee Supervisor",
                            value: "setSupervisor",
                            action: "Assign employee supervisor",
                            description: "Assign a supervisor to an employee using its ID or resource URI in a `text/URI-list`"
                        },
                        {
                            name: "Assign Subordinates",
                            value: "setSubordinates",
                            action: "Assign subordinates employees",
                            description: "Assign subordinates to an employee using a `text/URI-list`"
                        },
                        {
                            name: "Create",
                            value: "createEmployee",
                            action: "Create employee",
                            description: "Create an employee. provide the required `code`, `email`, `firstname`, and `lastname` fields."
                        },
                        {
                            name: "Delete Employee Photo",
                            value: "deleteEmployeePhoto",
                            action: "Delete employee photo",
                            description: "Delete an employee's photo"
                        },
                        {
                            name: "Get",
                            value: "getEmployee",
                            action: "Get employee",
                            description: "Retrieve an employee by ID"
                        },
                        {
                            name: "Get Employee Photo",
                            value: "getEmployeePhoto",
                            action: "Get employee photo",
                            description: "Retrieve an employee photo. set `alt` to `media` or request an `image/*` response to return image content; otherwise, the response is a file resource."
                        },
                        {
                            name: "Get Employee Position",
                            value: "getPosition_1",
                            action: "Get employee position",
                            description: "Retrieve the job position assigned to an employee"
                        },
                        {
                            name: "Get Employee Supervisor",
                            value: "getSupervisor",
                            action: "Get employee supervisor",
                            description: "Retrieve an employee's supervisor"
                        },
                        {
                            name: "List",
                            value: "getEmployees_1",
                            action: "List employees",
                            description: "List employees in a company. results are paginated; filter by supervisor, provider, position, or employee code."
                        },
                        {
                            name: "List Employee Clients",
                            value: "getClients",
                            action: "List employee clients",
                            description: "List clients assigned to an employee"
                        },
                        {
                            name: "List Employee Feedback Reports",
                            value: "getFeedbackReports_1",
                            action: "List employee feedback reports",
                            description: "List feedback reports from an employee's history"
                        },
                        {
                            name: "List Subordinates",
                            value: "getSubordinates",
                            action: "List subordinates employees",
                            description: "List an employee's subordinates"
                        },
                        {
                            name: "Remove Employee Clients",
                            value: "deleteClients",
                            action: "Remove employee clients",
                            description: "Remove client assignments from an employee using a `text/URI-list`"
                        },
                        {
                            name: "Remove Subordinates",
                            value: "deleteSubordinates",
                            action: "Remove subordinates employees",
                            description: "Remove subordinate assignments from an employee using a `text/URI-list`"
                        },
                        {
                            name: "Unassign Employee Position",
                            value: "deletePosition_1",
                            action: "Unassign employee position",
                            description: "Unassign the job position from an employee"
                        },
                        {
                            name: "Unassign Employee Supervisor",
                            value: "deleteSupervisor",
                            action: "Unassign employee supervisor",
                            description: "Unassign the employee's current supervisor"
                        },
                        {
                            name: "Update",
                            value: "updateEmployee",
                            action: "Update employee",
                            description: "Update an employee's details"
                        },
                        {
                            name: "Upload Employee Photo",
                            value: "setEmployeePhoto",
                            action: "Upload employee photo",
                            description: "Upload an employee photo as multipart form data. include the image in the `data` part; the media type is read from `content-type` or the filename extension."
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "createEmployee"
                            ]
                        }
                    }
                },
                {
                    displayName: "Code",
                    name: "code",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Employee code",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "createEmployee"
                            ]
                        }
                    }
                },
                {
                    displayName: "Email",
                    name: "email",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Email address",
                    placeholder: "name@email.com",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "createEmployee"
                            ]
                        }
                    }
                },
                {
                    displayName: "First Name",
                    name: "firstName",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "createEmployee"
                            ]
                        }
                    }
                },
                {
                    displayName: "Last Name",
                    name: "lastName",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "createEmployee"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "createEmployee"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Address",
                            name: "address",
                            type: "string",
                            default: "",
                            description: "Employee address"
                        },
                        {
                            displayName: "Birth Date",
                            name: "birthDate",
                            type: "string",
                            default: "",
                            description: "Employee date of birth",
                            placeholder: "e.g. 2019-10-31T23:00Z"
                        },
                        {
                            displayName: "City",
                            name: "city",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Country",
                            name: "country",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Date Created",
                            name: "dateCreated",
                            type: "string",
                            default: "",
                            description: "Date the employee record was created"
                        },
                        {
                            displayName: "Date Modified",
                            name: "dateModified",
                            type: "string",
                            default: "",
                            description: "Date the employee record was last modified"
                        },
                        {
                            displayName: "Embedded",
                            name: "_embedded",
                            type: "collection",
                            default: {},
                            placeholder: "Add Field",
                            options: [
                                {
                                    displayName: "Clients",
                                    name: "clients",
                                    type: "json",
                                    default: [],
                                    description: "List of employee's clients, if any"
                                },
                                {
                                    displayName: "Company",
                                    name: "company",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "ID",
                                            name: "id",
                                            type: "number",
                                            default: 0,
                                            description: "Company ID"
                                        },
                                        {
                                            displayName: "Name",
                                            name: "name",
                                            type: "string",
                                            default: "",
                                            description: "Company name"
                                        }
                                    ],
                                    description: "Simplified company object with the most important data"
                                },
                                {
                                    displayName: "Position",
                                    name: "position",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Code",
                                            name: "code",
                                            type: "string",
                                            default: "",
                                            description: "Position's code"
                                        },
                                        {
                                            displayName: "ID",
                                            name: "id",
                                            type: "number",
                                            default: 0,
                                            description: "Position's ID"
                                        },
                                        {
                                            displayName: "Name",
                                            name: "name",
                                            type: "string",
                                            default: "",
                                            description: "Position's name"
                                        }
                                    ],
                                    description: "Simplified position object with the most important data"
                                },
                                {
                                    displayName: "Supervisor",
                                    name: "supervisor",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Code",
                                            name: "code",
                                            type: "string",
                                            default: "",
                                            description: "Employee's code"
                                        },
                                        {
                                            displayName: "Email",
                                            name: "email",
                                            type: "string",
                                            default: "",
                                            description: "Employee's email",
                                            placeholder: "name@email.com"
                                        },
                                        {
                                            displayName: "First Name",
                                            name: "firstName",
                                            type: "string",
                                            default: "",
                                            description: "Employee's name"
                                        },
                                        {
                                            displayName: "ID",
                                            name: "id",
                                            type: "number",
                                            default: 0,
                                            description: "Employee's ID"
                                        },
                                        {
                                            displayName: "Last Name",
                                            name: "lastName",
                                            type: "string",
                                            default: "",
                                            description: "Employee's last name or surname"
                                        },
                                        {
                                            displayName: "Photo",
                                            name: "photo",
                                            type: "number",
                                            default: 0,
                                            description: "Employee's photo ID"
                                        }
                                    ],
                                    description: "Simplified employee object with the most important data"
                                }
                            ],
                            description: "Employeeembedded"
                        },
                        {
                            displayName: "External ID",
                            name: "externalId",
                            type: "string",
                            default: "",
                            description: "External employee ID. prefix it with `external-ID=` when using it in an API path.",
                            placeholder: "e.g. external-ID=123"
                        },
                        {
                            displayName: "Gender",
                            name: "gender",
                            type: "options",
                            default: "male",
                            description: "Employee gender",
                            options: [
                                {
                                    name: "Female",
                                    value: "female"
                                },
                                {
                                    name: "Male",
                                    value: "male"
                                },
                                {
                                    name: "Other",
                                    value: "other"
                                }
                            ]
                        },
                        {
                            displayName: "Hire Date",
                            name: "hireDate",
                            type: "string",
                            default: "",
                            description: "Employee hire date. use `dd/mm/yyyy`.",
                            placeholder: "e.g. 2019-10-31T23:00Z"
                        },
                        {
                            displayName: "ID",
                            name: "id",
                            type: "number",
                            default: 0,
                            description: "Employee ID"
                        },
                        {
                            displayName: "Links",
                            name: "_links",
                            type: "collection",
                            default: {},
                            placeholder: "Add Field",
                            options: [
                                {
                                    displayName: "Clients",
                                    name: "clients",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Company",
                                    name: "company",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Feedback Reports",
                                    name: "feedbackReports",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Photo",
                                    name: "photo",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Photo Content",
                                    name: "photoContent",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Position",
                                    name: "position",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Self",
                                    name: "self",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Subordinates",
                                    name: "subordinates",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Supervisor",
                                    name: "supervisor",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                }
                            ],
                            description: "Employeelinks"
                        },
                        {
                            displayName: "National ID",
                            name: "nationalId",
                            type: "string",
                            default: "",
                            description: "Employee national identification number"
                        },
                        {
                            displayName: "Notes",
                            name: "notes",
                            type: "string",
                            default: "",
                            description: "Additional notes about the employee"
                        },
                        {
                            displayName: "On Archived",
                            name: "onArchived",
                            type: "options",
                            default: "reactivateIfSameCodeAndEmail",
                            description: "Controls how a matching archived employee is handled: `reactivateifsamecodeandemail` (default) matches code and email; `reactivateifsamecode` matches code only; `ignore` creates a new employee. reactivated employees use a company license.",
                            options: [
                                {
                                    name: "Ignore",
                                    value: "ignore"
                                },
                                {
                                    name: "ReactivateIfSameCode",
                                    value: "reactivateIfSameCode"
                                },
                                {
                                    name: "ReactivateIfSameCodeAndEmail",
                                    value: "reactivateIfSameCodeAndEmail"
                                }
                            ]
                        },
                        {
                            displayName: "Phone",
                            name: "phone",
                            type: "string",
                            default: "",
                            description: "Phone number"
                        },
                        {
                            displayName: "Phone2",
                            name: "phone2",
                            type: "string",
                            default: "",
                            description: "Secondary phone number"
                        },
                        {
                            displayName: "Photo",
                            name: "photo",
                            type: "number",
                            default: 0,
                            description: "Employee photo file ID"
                        },
                        {
                            displayName: "Postal Code",
                            name: "postalCode",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Province",
                            name: "province",
                            type: "string",
                            default: "",
                            description: "Province or state"
                        }
                    ]
                },
                {
                    displayName: "Output",
                    name: "outputMode",
                    type: "options",
                    default: "simplified",
                    description: "Choose whether to return useful fields, the raw response, or selected fields",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "createEmployee"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Raw",
                            value: "raw",
                            description: "Return the complete API response"
                        },
                        {
                            name: "Selected Fields",
                            value: "selected",
                            description: "Return only selected fields"
                        },
                        {
                            name: "Simplified",
                            value: "simplified",
                            description: "Return up to 10 useful fields"
                        }
                    ]
                },
                {
                    displayName: "Fields to Include",
                    name: "selectedFields",
                    type: "multiOptions",
                    default: [
                        "id",
                        "email",
                        "address",
                        "birthDate",
                        "city",
                        "code",
                        "country",
                        "dateCreated",
                        "dateModified",
                        "externalId"
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "createEmployee"
                            ],
                            outputMode: [
                                "selected"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Address",
                            value: "address"
                        },
                        {
                            name: "BirthDate",
                            value: "birthDate"
                        },
                        {
                            name: "City",
                            value: "city"
                        },
                        {
                            name: "Code",
                            value: "code"
                        },
                        {
                            name: "Country",
                            value: "country"
                        },
                        {
                            name: "DateCreated",
                            value: "dateCreated"
                        },
                        {
                            name: "DateModified",
                            value: "dateModified"
                        },
                        {
                            name: "Email",
                            value: "email"
                        },
                        {
                            name: "Embedded",
                            value: "_embedded"
                        },
                        {
                            name: "ExternalId",
                            value: "externalId"
                        },
                        {
                            name: "FirstName",
                            value: "firstName"
                        },
                        {
                            name: "Gender",
                            value: "gender"
                        },
                        {
                            name: "HireDate",
                            value: "hireDate"
                        },
                        {
                            name: "ID",
                            value: "id"
                        },
                        {
                            name: "LastName",
                            value: "lastName"
                        },
                        {
                            name: "Links",
                            value: "_links"
                        },
                        {
                            name: "NationalId",
                            value: "nationalId"
                        },
                        {
                            name: "Notes",
                            value: "notes"
                        },
                        {
                            name: "Phone",
                            value: "phone"
                        },
                        {
                            name: "Phone2",
                            value: "phone2"
                        },
                        {
                            name: "Photo",
                            value: "photo"
                        },
                        {
                            name: "PostalCode",
                            value: "postalCode"
                        },
                        {
                            name: "Province",
                            value: "province"
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "deleteClients"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Employee ID. for an external employee ID, use the `externalid=` prefix.",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "deleteClients"
                            ]
                        }
                    }
                },
                {
                    displayName: "Body",
                    name: "bodyJson",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Raw request body",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "deleteClients"
                            ]
                        }
                    }
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "deleteEmployee"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Employee ID. for an external employee ID, use the `externalid=` prefix.",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "deleteEmployee"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "deleteEmployee"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Archive",
                            name: "archive",
                            type: "boolean",
                            default: true,
                            description: "Whether set to `true` (default) to archive the employee and preserve history while freeing a company license. set to `false` to delete the employee."
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "deleteEmployeePhoto"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Employee ID. for an external employee ID, use the `externalid=` prefix.",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "deleteEmployeePhoto"
                            ]
                        }
                    }
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "deletePosition_1"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Employee ID. for an external employee ID, use the `externalid=` prefix.",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "deletePosition_1"
                            ]
                        }
                    }
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "deleteSubordinates"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Employee ID. for an external employee ID, use the `externalid=` prefix.",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "deleteSubordinates"
                            ]
                        }
                    }
                },
                {
                    displayName: "Body",
                    name: "bodyJson",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Raw request body",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "deleteSubordinates"
                            ]
                        }
                    }
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "deleteSupervisor"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Employee ID. for an external employee ID, use the `externalid=` prefix.",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "deleteSupervisor"
                            ]
                        }
                    }
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "getClients"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Employee ID. for an external employee ID, use the `externalid=` prefix.",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "getClients"
                            ]
                        }
                    }
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "getEmployee"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Employee ID. for an external employee ID, use the `externalid=` prefix.",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "getEmployee"
                            ]
                        }
                    }
                },
                {
                    displayName: "Output",
                    name: "outputMode",
                    type: "options",
                    default: "simplified",
                    description: "Choose whether to return useful fields, the raw response, or selected fields",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "getEmployee"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Raw",
                            value: "raw",
                            description: "Return the complete API response"
                        },
                        {
                            name: "Selected Fields",
                            value: "selected",
                            description: "Return only selected fields"
                        },
                        {
                            name: "Simplified",
                            value: "simplified",
                            description: "Return up to 10 useful fields"
                        }
                    ]
                },
                {
                    displayName: "Fields to Include",
                    name: "selectedFields",
                    type: "multiOptions",
                    default: [
                        "id",
                        "email",
                        "address",
                        "birthDate",
                        "city",
                        "code",
                        "country",
                        "dateCreated",
                        "dateModified",
                        "externalId"
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "getEmployee"
                            ],
                            outputMode: [
                                "selected"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Address",
                            value: "address"
                        },
                        {
                            name: "BirthDate",
                            value: "birthDate"
                        },
                        {
                            name: "City",
                            value: "city"
                        },
                        {
                            name: "Code",
                            value: "code"
                        },
                        {
                            name: "Country",
                            value: "country"
                        },
                        {
                            name: "DateCreated",
                            value: "dateCreated"
                        },
                        {
                            name: "DateModified",
                            value: "dateModified"
                        },
                        {
                            name: "Email",
                            value: "email"
                        },
                        {
                            name: "Embedded",
                            value: "_embedded"
                        },
                        {
                            name: "ExternalId",
                            value: "externalId"
                        },
                        {
                            name: "FirstName",
                            value: "firstName"
                        },
                        {
                            name: "Gender",
                            value: "gender"
                        },
                        {
                            name: "HireDate",
                            value: "hireDate"
                        },
                        {
                            name: "ID",
                            value: "id"
                        },
                        {
                            name: "LastName",
                            value: "lastName"
                        },
                        {
                            name: "Links",
                            value: "_links"
                        },
                        {
                            name: "NationalId",
                            value: "nationalId"
                        },
                        {
                            name: "Notes",
                            value: "notes"
                        },
                        {
                            name: "Phone",
                            value: "phone"
                        },
                        {
                            name: "Phone2",
                            value: "phone2"
                        },
                        {
                            name: "Photo",
                            value: "photo"
                        },
                        {
                            name: "PostalCode",
                            value: "postalCode"
                        },
                        {
                            name: "Province",
                            value: "province"
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "getEmployeePhoto"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Employee ID. for an external employee ID, use the `externalid=` prefix.",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "getEmployeePhoto"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "getEmployeePhoto"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Accept",
                            name: "accept",
                            type: "string",
                            default: "",
                            description: "Request an `image/*` media type to return file content"
                        },
                        {
                            displayName: "Alt",
                            name: "alt",
                            type: "string",
                            default: "",
                            description: "Set to `media` to return file content instead of file metadata"
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "getEmployees_1"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "getEmployees_1"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Code",
                            name: "code",
                            type: "string",
                            default: "",
                            description: "Filter employees by employee code"
                        },
                        {
                            displayName: "Page",
                            name: "page",
                            type: "number",
                            default: 0,
                            description: "Page number to retrieve"
                        },
                        {
                            displayName: "Page Size",
                            name: "pageSize",
                            type: "number",
                            default: 0,
                            description: "Number of results to return per page"
                        },
                        {
                            displayName: "Position ID",
                            name: "positionId",
                            type: "number",
                            default: 0,
                            description: "Filter employees by job position ID"
                        },
                        {
                            displayName: "Provider ID",
                            name: "providerId",
                            type: "number",
                            default: 0,
                            description: "Filter employees by provider ID"
                        },
                        {
                            displayName: "Supervisor ID",
                            name: "supervisorId",
                            type: "number",
                            default: 0,
                            description: "Filter employees by supervisor ID"
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "getFeedbackReports_1"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Employee ID. for an external employee ID, use the `externalid=` prefix.",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "getFeedbackReports_1"
                            ]
                        }
                    }
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "getPosition_1"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Employee ID. for an external employee ID, use the `externalid=` prefix.",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "getPosition_1"
                            ]
                        }
                    }
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "getSubordinates"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Employee ID. for an external employee ID, use the `externalid=` prefix.",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "getSubordinates"
                            ]
                        }
                    }
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "getSupervisor"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Employee ID. for an external employee ID, use the `externalid=` prefix.",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "getSupervisor"
                            ]
                        }
                    }
                },
                {
                    displayName: "Output",
                    name: "outputMode",
                    type: "options",
                    default: "simplified",
                    description: "Choose whether to return useful fields, the raw response, or selected fields",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "getSupervisor"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Raw",
                            value: "raw",
                            description: "Return the complete API response"
                        },
                        {
                            name: "Selected Fields",
                            value: "selected",
                            description: "Return only selected fields"
                        },
                        {
                            name: "Simplified",
                            value: "simplified",
                            description: "Return up to 10 useful fields"
                        }
                    ]
                },
                {
                    displayName: "Fields to Include",
                    name: "selectedFields",
                    type: "multiOptions",
                    default: [
                        "id",
                        "email",
                        "address",
                        "birthDate",
                        "city",
                        "code",
                        "country",
                        "dateCreated",
                        "dateModified",
                        "externalId"
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "getSupervisor"
                            ],
                            outputMode: [
                                "selected"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Address",
                            value: "address"
                        },
                        {
                            name: "BirthDate",
                            value: "birthDate"
                        },
                        {
                            name: "City",
                            value: "city"
                        },
                        {
                            name: "Code",
                            value: "code"
                        },
                        {
                            name: "Country",
                            value: "country"
                        },
                        {
                            name: "DateCreated",
                            value: "dateCreated"
                        },
                        {
                            name: "DateModified",
                            value: "dateModified"
                        },
                        {
                            name: "Email",
                            value: "email"
                        },
                        {
                            name: "Embedded",
                            value: "_embedded"
                        },
                        {
                            name: "ExternalId",
                            value: "externalId"
                        },
                        {
                            name: "FirstName",
                            value: "firstName"
                        },
                        {
                            name: "Gender",
                            value: "gender"
                        },
                        {
                            name: "HireDate",
                            value: "hireDate"
                        },
                        {
                            name: "ID",
                            value: "id"
                        },
                        {
                            name: "LastName",
                            value: "lastName"
                        },
                        {
                            name: "Links",
                            value: "_links"
                        },
                        {
                            name: "NationalId",
                            value: "nationalId"
                        },
                        {
                            name: "Notes",
                            value: "notes"
                        },
                        {
                            name: "Phone",
                            value: "phone"
                        },
                        {
                            name: "Phone2",
                            value: "phone2"
                        },
                        {
                            name: "Photo",
                            value: "photo"
                        },
                        {
                            name: "PostalCode",
                            value: "postalCode"
                        },
                        {
                            name: "Province",
                            value: "province"
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "setClients"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Employee ID. for an external employee ID, use the `externalid=` prefix.",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "setClients"
                            ]
                        }
                    }
                },
                {
                    displayName: "Body",
                    name: "bodyJson",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Raw request body",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "setClients"
                            ]
                        }
                    }
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "setEmployeePhoto"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Employee ID. for an external employee ID, use the `externalid=` prefix.",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "setEmployeePhoto"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "setEmployeePhoto"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Data",
                            name: "data",
                            type: "json",
                            default: {},
                            description: "Image file to upload"
                        }
                    ]
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "setPosition"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Employee ID. for an external employee ID, use the `externalid=` prefix.",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "setPosition"
                            ]
                        }
                    }
                },
                {
                    displayName: "Body",
                    name: "bodyJson",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Raw request body",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "setPosition"
                            ]
                        }
                    }
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "setSubordinates"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Employee ID. for an external employee ID, use the `externalid=` prefix.",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "setSubordinates"
                            ]
                        }
                    }
                },
                {
                    displayName: "Body",
                    name: "bodyJson",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Raw request body",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "setSubordinates"
                            ]
                        }
                    }
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "setSupervisor"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Employee ID. for an external employee ID, use the `externalid=` prefix.",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "setSupervisor"
                            ]
                        }
                    }
                },
                {
                    displayName: "Body",
                    name: "bodyJson",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Raw request body",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "setSupervisor"
                            ]
                        }
                    }
                },
                {
                    displayName: "Company ID",
                    name: "companyId",
                    type: "number",
                    default: 0,
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "updateEmployee"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Employee ID. for an external employee ID, use the `externalid=` prefix.",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "updateEmployee"
                            ]
                        }
                    }
                },
                {
                    displayName: "Code",
                    name: "code",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Employee code",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "updateEmployee"
                            ]
                        }
                    }
                },
                {
                    displayName: "Email",
                    name: "email",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Email address",
                    placeholder: "name@email.com",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "updateEmployee"
                            ]
                        }
                    }
                },
                {
                    displayName: "First Name",
                    name: "firstName",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "updateEmployee"
                            ]
                        }
                    }
                },
                {
                    displayName: "Last Name",
                    name: "lastName",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "updateEmployee"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "updateEmployee"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Address",
                            name: "address",
                            type: "string",
                            default: "",
                            description: "Employee address"
                        },
                        {
                            displayName: "Birth Date",
                            name: "birthDate",
                            type: "string",
                            default: "",
                            description: "Employee date of birth",
                            placeholder: "e.g. 2019-10-31T23:00Z"
                        },
                        {
                            displayName: "City",
                            name: "city",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Country",
                            name: "country",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Date Created",
                            name: "dateCreated",
                            type: "string",
                            default: "",
                            description: "Date the employee record was created"
                        },
                        {
                            displayName: "Date Modified",
                            name: "dateModified",
                            type: "string",
                            default: "",
                            description: "Date the employee record was last modified"
                        },
                        {
                            displayName: "Embedded",
                            name: "_embedded",
                            type: "collection",
                            default: {},
                            placeholder: "Add Field",
                            options: [
                                {
                                    displayName: "Clients",
                                    name: "clients",
                                    type: "json",
                                    default: [],
                                    description: "List of employee's clients, if any"
                                },
                                {
                                    displayName: "Company",
                                    name: "company",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "ID",
                                            name: "id",
                                            type: "number",
                                            default: 0,
                                            description: "Company ID"
                                        },
                                        {
                                            displayName: "Name",
                                            name: "name",
                                            type: "string",
                                            default: "",
                                            description: "Company name"
                                        }
                                    ],
                                    description: "Simplified company object with the most important data"
                                },
                                {
                                    displayName: "Position",
                                    name: "position",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Code",
                                            name: "code",
                                            type: "string",
                                            default: "",
                                            description: "Position's code"
                                        },
                                        {
                                            displayName: "ID",
                                            name: "id",
                                            type: "number",
                                            default: 0,
                                            description: "Position's ID"
                                        },
                                        {
                                            displayName: "Name",
                                            name: "name",
                                            type: "string",
                                            default: "",
                                            description: "Position's name"
                                        }
                                    ],
                                    description: "Simplified position object with the most important data"
                                },
                                {
                                    displayName: "Supervisor",
                                    name: "supervisor",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Code",
                                            name: "code",
                                            type: "string",
                                            default: "",
                                            description: "Employee's code"
                                        },
                                        {
                                            displayName: "Email",
                                            name: "email",
                                            type: "string",
                                            default: "",
                                            description: "Employee's email",
                                            placeholder: "name@email.com"
                                        },
                                        {
                                            displayName: "First Name",
                                            name: "firstName",
                                            type: "string",
                                            default: "",
                                            description: "Employee's name"
                                        },
                                        {
                                            displayName: "ID",
                                            name: "id",
                                            type: "number",
                                            default: 0,
                                            description: "Employee's ID"
                                        },
                                        {
                                            displayName: "Last Name",
                                            name: "lastName",
                                            type: "string",
                                            default: "",
                                            description: "Employee's last name or surname"
                                        },
                                        {
                                            displayName: "Photo",
                                            name: "photo",
                                            type: "number",
                                            default: 0,
                                            description: "Employee's photo ID"
                                        }
                                    ],
                                    description: "Simplified employee object with the most important data"
                                }
                            ],
                            description: "Employeeembedded"
                        },
                        {
                            displayName: "External ID",
                            name: "externalId",
                            type: "string",
                            default: "",
                            description: "External employee ID. prefix it with `external-ID=` when using it in an API path.",
                            placeholder: "e.g. external-ID=123"
                        },
                        {
                            displayName: "Gender",
                            name: "gender",
                            type: "options",
                            default: "male",
                            description: "Employee gender",
                            options: [
                                {
                                    name: "Female",
                                    value: "female"
                                },
                                {
                                    name: "Male",
                                    value: "male"
                                },
                                {
                                    name: "Other",
                                    value: "other"
                                }
                            ]
                        },
                        {
                            displayName: "Hire Date",
                            name: "hireDate",
                            type: "string",
                            default: "",
                            description: "Employee hire date. use `dd/mm/yyyy`.",
                            placeholder: "e.g. 2019-10-31T23:00Z"
                        },
                        {
                            displayName: "ID (Body)",
                            name: "idBody",
                            type: "number",
                            default: 0,
                            description: "Employee ID"
                        },
                        {
                            displayName: "Links",
                            name: "_links",
                            type: "collection",
                            default: {},
                            placeholder: "Add Field",
                            options: [
                                {
                                    displayName: "Clients",
                                    name: "clients",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Company",
                                    name: "company",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Feedback Reports",
                                    name: "feedbackReports",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Photo",
                                    name: "photo",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Photo Content",
                                    name: "photoContent",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Position",
                                    name: "position",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Self",
                                    name: "self",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Subordinates",
                                    name: "subordinates",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                },
                                {
                                    displayName: "Supervisor",
                                    name: "supervisor",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Href",
                                            name: "href",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Path",
                                            name: "path",
                                            type: "string",
                                            default: ""
                                        },
                                        {
                                            displayName: "Query Params",
                                            name: "queryParams",
                                            type: "json",
                                            default: []
                                        }
                                    ],
                                    description: "Administrators"
                                }
                            ],
                            description: "Employeelinks"
                        },
                        {
                            displayName: "National ID",
                            name: "nationalId",
                            type: "string",
                            default: "",
                            description: "Employee national identification number"
                        },
                        {
                            displayName: "Notes",
                            name: "notes",
                            type: "string",
                            default: "",
                            description: "Additional notes about the employee"
                        },
                        {
                            displayName: "Phone",
                            name: "phone",
                            type: "string",
                            default: "",
                            description: "Phone number"
                        },
                        {
                            displayName: "Phone2",
                            name: "phone2",
                            type: "string",
                            default: "",
                            description: "Secondary phone number"
                        },
                        {
                            displayName: "Photo",
                            name: "photo",
                            type: "number",
                            default: 0,
                            description: "Employee photo file ID"
                        },
                        {
                            displayName: "Postal Code",
                            name: "postalCode",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Province",
                            name: "province",
                            type: "string",
                            default: "",
                            description: "Province or state"
                        }
                    ]
                },
                {
                    displayName: "Output",
                    name: "outputMode",
                    type: "options",
                    default: "simplified",
                    description: "Choose whether to return useful fields, the raw response, or selected fields",
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "updateEmployee"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Raw",
                            value: "raw",
                            description: "Return the complete API response"
                        },
                        {
                            name: "Selected Fields",
                            value: "selected",
                            description: "Return only selected fields"
                        },
                        {
                            name: "Simplified",
                            value: "simplified",
                            description: "Return up to 10 useful fields"
                        }
                    ]
                },
                {
                    displayName: "Fields to Include",
                    name: "selectedFields",
                    type: "multiOptions",
                    default: [
                        "id",
                        "email",
                        "address",
                        "birthDate",
                        "city",
                        "code",
                        "country",
                        "dateCreated",
                        "dateModified",
                        "externalId"
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "employees"
                            ],
                            operation: [
                                "updateEmployee"
                            ],
                            outputMode: [
                                "selected"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Address",
                            value: "address"
                        },
                        {
                            name: "BirthDate",
                            value: "birthDate"
                        },
                        {
                            name: "City",
                            value: "city"
                        },
                        {
                            name: "Code",
                            value: "code"
                        },
                        {
                            name: "Country",
                            value: "country"
                        },
                        {
                            name: "DateCreated",
                            value: "dateCreated"
                        },
                        {
                            name: "DateModified",
                            value: "dateModified"
                        },
                        {
                            name: "Email",
                            value: "email"
                        },
                        {
                            name: "Embedded",
                            value: "_embedded"
                        },
                        {
                            name: "ExternalId",
                            value: "externalId"
                        },
                        {
                            name: "FirstName",
                            value: "firstName"
                        },
                        {
                            name: "Gender",
                            value: "gender"
                        },
                        {
                            name: "HireDate",
                            value: "hireDate"
                        },
                        {
                            name: "ID",
                            value: "id"
                        },
                        {
                            name: "LastName",
                            value: "lastName"
                        },
                        {
                            name: "Links",
                            value: "_links"
                        },
                        {
                            name: "NationalId",
                            value: "nationalId"
                        },
                        {
                            name: "Notes",
                            value: "notes"
                        },
                        {
                            name: "Phone",
                            value: "phone"
                        },
                        {
                            name: "Phone2",
                            value: "phone2"
                        },
                        {
                            name: "Photo",
                            value: "photo"
                        },
                        {
                            name: "PostalCode",
                            value: "postalCode"
                        },
                        {
                            name: "Province",
                            value: "province"
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "files"
                            ]
                        }
                    },
                    default: "getFile",
                    options: [
                        {
                            name: "Get",
                            value: "getFile",
                            action: "Get file",
                            description: "Retrieve file metadata. set `alt` to `media` or request an `image/*` response to return file content."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "File ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "files"
                            ],
                            operation: [
                                "getFile"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "files"
                            ],
                            operation: [
                                "getFile"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Accept",
                            name: "accept",
                            type: "string",
                            default: "",
                            description: "Request an `image/*` media type to return file content"
                        },
                        {
                            displayName: "Alt",
                            name: "alt",
                            type: "string",
                            default: "",
                            description: "Set to `media` to return file content instead of file metadata"
                        }
                    ]
                }
            ]
        };
    }
    async execute() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        const inputItems = this.getInputData();
        const output = [];
        for (let itemIndex = 0; itemIndex < inputItems.length; itemIndex += 1) {
            const outputStart = output.length;
            let errorPlan = {};
            try {
                const operation = this.getNodeParameter('operation', itemIndex);
                const nodeVersion = this.getNode().typeVersion;
                let additionalFields = {};
                const nodeOptions = this.getNodeParameter('options', itemIndex, {});
                let retryContract = { mode: 'none', maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0 };
                let credentialApplications;
                let options;
                let pagination = { style: 'none', advancement: '', maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10 * 1024 * 1024, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                let responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                switch (operation) {
                    case "changePassword": {
                        let path = "/api/v1/administrators/{id}/change-password";
                        const qs = {};
                        const headers = {};
                        let body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        body = normalizeParameterValue(this.getNodeParameter("bodyJson", itemIndex));
                        validateBodyValue(body, { "name": "bodyJson", "displayName": "Body JSON", "type": "string", "required": true, "description": "Raw request body", "representation": "raw" }, "Body JSON", this, itemIndex);
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "PUT", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "*/*" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If administrator is not found" } };
                        break;
                    }
                    case "createAdministrator": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/api/v1/administrators";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["_embedded"] !== undefined)
                            setBodyField(body, { "name": "_embedded", "displayName": "Embedded", "description": "AdministratorEmbedded", "type": "object", "representation": "raw", "fields": [{ "name": "companies", "displayName": "Companies", "description": "List of companies that an administrator can access", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "description": "Simplified Company object with the most important data", "type": "object", "representation": "raw", "fields": [{ "name": "id", "displayName": "Id", "description": "Company ID", "type": "integer", "format": "int64" }, { "name": "name", "displayName": "Name", "description": "Company name", "type": "string" }] } }] }, additionalFields["_embedded"], this, itemIndex);
                        if (additionalFields["_links"] !== undefined)
                            setBodyField(body, { "name": "_links", "displayName": "Links", "description": "AdministratorLinks", "type": "object", "representation": "raw", "fields": [{ "name": "changePassword", "displayName": "Change Password", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "companies", "displayName": "Companies", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "self", "displayName": "Self", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }] }, additionalFields["_links"], this, itemIndex);
                        if (additionalFields["address"] !== undefined)
                            setBodyField(body, { "name": "address", "displayName": "Address", "description": "Postal address.", "type": "string" }, additionalFields["address"], this, itemIndex);
                        if (additionalFields["city"] !== undefined)
                            setBodyField(body, { "name": "city", "displayName": "City", "description": "City.", "type": "string" }, additionalFields["city"], this, itemIndex);
                        if (additionalFields["country"] !== undefined)
                            setBodyField(body, { "name": "country", "displayName": "Country", "description": "Country.", "type": "string" }, additionalFields["country"], this, itemIndex);
                        if (additionalFields["dateCreated"] !== undefined)
                            setBodyField(body, { "name": "dateCreated", "displayName": "Date Created", "description": "Date the administrator record was created.", "type": "string" }, additionalFields["dateCreated"], this, itemIndex);
                        if (additionalFields["dateModified"] !== undefined)
                            setBodyField(body, { "name": "dateModified", "displayName": "Date Modified", "description": "Date the administrator record was last modified.", "type": "string" }, additionalFields["dateModified"], this, itemIndex);
                        if (additionalFields["email"] !== undefined)
                            setBodyField(body, { "name": "email", "displayName": "Email", "description": "Email address.", "type": "string" }, additionalFields["email"], this, itemIndex);
                        if (additionalFields["firstName"] !== undefined)
                            setBodyField(body, { "name": "firstName", "displayName": "First Name", "description": "First name.", "type": "string" }, additionalFields["firstName"], this, itemIndex);
                        if (additionalFields["id"] !== undefined)
                            setBodyField(body, { "name": "id", "displayName": "Id", "description": "Administrator ID.", "type": "integer", "format": "int64" }, additionalFields["id"], this, itemIndex);
                        if (additionalFields["language"] !== undefined)
                            setBodyField(body, { "name": "language", "displayName": "Language", "description": "Language used in the HRider interface.", "type": "string", "enum": ["es", "en", "ca", "fr", "pt", "it", "de"] }, additionalFields["language"], this, itemIndex);
                        if (additionalFields["lastName"] !== undefined)
                            setBodyField(body, { "name": "lastName", "displayName": "Last Name", "description": "Last name.", "type": "string" }, additionalFields["lastName"], this, itemIndex);
                        if (additionalFields["nationalId"] !== undefined)
                            setBodyField(body, { "name": "nationalId", "displayName": "National Id", "description": "Administrator national identification number.", "type": "string" }, additionalFields["nationalId"], this, itemIndex);
                        if (additionalFields["organization"] !== undefined)
                            setBodyField(body, { "name": "organization", "displayName": "Organization", "description": "Organization name.", "type": "string" }, additionalFields["organization"], this, itemIndex);
                        if (additionalFields["phone"] !== undefined)
                            setBodyField(body, { "name": "phone", "displayName": "Phone", "description": "Phone number.", "type": "string" }, additionalFields["phone"], this, itemIndex);
                        if (additionalFields["postalCode"] !== undefined)
                            setBodyField(body, { "name": "postalCode", "displayName": "Postal Code", "description": "Postal code.", "type": "string" }, additionalFields["postalCode"], this, itemIndex);
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links", "address", "city", "country", "dateCreated", "dateModified", "email", "firstName", "id", "language", "lastName", "nationalId", "organization", "phone", "postalCode"], simplified: ["id", "email", "address", "city", "country", "dateCreated", "dateModified", "firstName", "language", "lastName"] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "409": { "title": "Conflict. If data is invalid, e.g. email is empty" } };
                        break;
                    }
                    case "deleteAdministrator": {
                        let path = "/api/v1/administrators/{id}";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If administrator is not found" } };
                        break;
                    }
                    case "getAdministrator": {
                        let path = "/api/v1/administrators/{id}";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links", "address", "city", "country", "dateCreated", "dateModified", "email", "firstName", "id", "language", "lastName", "nationalId", "organization", "phone", "postalCode"], simplified: ["id", "email", "address", "city", "country", "dateCreated", "dateModified", "firstName", "language", "lastName"] };
                        errorPlan = { "404": { "title": "Not found. If Administrator cannot be found" } };
                        break;
                    }
                    case "getAdministrators": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/api/v1/administrators";
                        const qs = {};
                        const body = {};
                        if (additionalFields["companyId"] !== undefined)
                            qs["companyId"] = additionalFields["companyId"];
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links"], simplified: ["_embedded", "_links"] };
                        errorPlan = { "409": { "title": "Conflict. If the Company ID parameter is invalid" } };
                        break;
                    }
                    case "getCompanies": {
                        let path = "/api/v1/administrators/{id}/companies";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "301": { "title": "Moved permanently. Moved to '/companies?administratorId={id}'" } };
                        break;
                    }
                    case "relateCompanies": {
                        let path = "/api/v1/administrators/{id}/companies";
                        const qs = {};
                        const headers = {};
                        let body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        body = normalizeParameterValue(this.getNodeParameter("bodyJson", itemIndex));
                        validateBodyValue(body, { "name": "bodyJson", "displayName": "Body", "type": "string", "required": true, "description": "Raw request body", "representation": "raw" }, "Body", this, itemIndex);
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "PUT", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "text/uri-list" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If administrator is not found" }, "409": { "title": "Conflict. If data is invalid, e.g. any Company is not found" } };
                        break;
                    }
                    case "unrelateCompanies": {
                        let path = "/api/v1/administrators/{id}/companies";
                        const qs = {};
                        const headers = {};
                        let body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        body = normalizeParameterValue(this.getNodeParameter("bodyJson", itemIndex));
                        validateBodyValue(body, { "name": "bodyJson", "displayName": "Body", "type": "string", "required": true, "description": "Raw request body", "representation": "raw" }, "Body", this, itemIndex);
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "text/uri-list" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If administrator is not found, e.g any Company is not found" }, "409": { "title": "Conflict. If data is invalid." } };
                        break;
                    }
                    case "updateAdministrator": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/administrators/{id}";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["updatePassword"] !== undefined)
                            qs["updatePassword"] = additionalFields["updatePassword"];
                        if (additionalFields["_embedded"] !== undefined)
                            setBodyField(body, { "name": "_embedded", "displayName": "Embedded", "description": "AdministratorEmbedded", "type": "object", "representation": "raw", "fields": [{ "name": "companies", "displayName": "Companies", "description": "List of companies that an administrator can access", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "description": "Simplified Company object with the most important data", "type": "object", "representation": "raw", "fields": [{ "name": "id", "displayName": "Id", "description": "Company ID", "type": "integer", "format": "int64" }, { "name": "name", "displayName": "Name", "description": "Company name", "type": "string" }] } }] }, additionalFields["_embedded"], this, itemIndex);
                        if (additionalFields["_links"] !== undefined)
                            setBodyField(body, { "name": "_links", "displayName": "Links", "description": "AdministratorLinks", "type": "object", "representation": "raw", "fields": [{ "name": "changePassword", "displayName": "Change Password", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "companies", "displayName": "Companies", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "self", "displayName": "Self", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }] }, additionalFields["_links"], this, itemIndex);
                        if (additionalFields["address"] !== undefined)
                            setBodyField(body, { "name": "address", "displayName": "Address", "description": "Postal address.", "type": "string" }, additionalFields["address"], this, itemIndex);
                        if (additionalFields["city"] !== undefined)
                            setBodyField(body, { "name": "city", "displayName": "City", "description": "City.", "type": "string" }, additionalFields["city"], this, itemIndex);
                        if (additionalFields["country"] !== undefined)
                            setBodyField(body, { "name": "country", "displayName": "Country", "description": "Country.", "type": "string" }, additionalFields["country"], this, itemIndex);
                        if (additionalFields["dateCreated"] !== undefined)
                            setBodyField(body, { "name": "dateCreated", "displayName": "Date Created", "description": "Date the administrator record was created.", "type": "string" }, additionalFields["dateCreated"], this, itemIndex);
                        if (additionalFields["dateModified"] !== undefined)
                            setBodyField(body, { "name": "dateModified", "displayName": "Date Modified", "description": "Date the administrator record was last modified.", "type": "string" }, additionalFields["dateModified"], this, itemIndex);
                        if (additionalFields["email"] !== undefined)
                            setBodyField(body, { "name": "email", "displayName": "Email", "description": "Email address.", "type": "string" }, additionalFields["email"], this, itemIndex);
                        if (additionalFields["firstName"] !== undefined)
                            setBodyField(body, { "name": "firstName", "displayName": "First Name", "description": "First name.", "type": "string" }, additionalFields["firstName"], this, itemIndex);
                        if (additionalFields["idBody"] !== undefined)
                            setBodyField(body, { "name": "id", "displayName": "Id", "description": "Administrator ID.", "type": "integer", "format": "int64" }, additionalFields["idBody"], this, itemIndex);
                        if (additionalFields["language"] !== undefined)
                            setBodyField(body, { "name": "language", "displayName": "Language", "description": "Language used in the HRider interface.", "type": "string", "enum": ["es", "en", "ca", "fr", "pt", "it", "de"] }, additionalFields["language"], this, itemIndex);
                        if (additionalFields["lastName"] !== undefined)
                            setBodyField(body, { "name": "lastName", "displayName": "Last Name", "description": "Last name.", "type": "string" }, additionalFields["lastName"], this, itemIndex);
                        if (additionalFields["nationalId"] !== undefined)
                            setBodyField(body, { "name": "nationalId", "displayName": "National Id", "description": "Administrator national identification number.", "type": "string" }, additionalFields["nationalId"], this, itemIndex);
                        if (additionalFields["organization"] !== undefined)
                            setBodyField(body, { "name": "organization", "displayName": "Organization", "description": "Organization name.", "type": "string" }, additionalFields["organization"], this, itemIndex);
                        if (additionalFields["phone"] !== undefined)
                            setBodyField(body, { "name": "phone", "displayName": "Phone", "description": "Phone number.", "type": "string" }, additionalFields["phone"], this, itemIndex);
                        if (additionalFields["postalCode"] !== undefined)
                            setBodyField(body, { "name": "postalCode", "displayName": "Postal Code", "description": "Postal code.", "type": "string" }, additionalFields["postalCode"], this, itemIndex);
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "PUT", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links", "address", "city", "country", "dateCreated", "dateModified", "email", "firstName", "id", "language", "lastName", "nationalId", "organization", "phone", "postalCode"], simplified: ["id", "email", "address", "city", "country", "dateCreated", "dateModified", "firstName", "language", "lastName"] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If administrator is not found" }, "409": { "title": "Conflict. If data is invalid, e.g. email is empty" } };
                        break;
                    }
                    case "getAppraisal": {
                        let path = "/api/v1/companies/{companyId}/appraisals/{appraisalId}";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{appraisalId}").join(encodeURIComponent(String(this.getNodeParameter("appraisalId", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links", "code", "companyId", "dateCreated", "dateModified", "description", "endDate", "feedbackInfo", "id", "nboxInfo", "reviewOpened", "startDate", "state", "type", "workEnvironmentInfo"], simplified: ["id", "type", "description", "code", "companyId", "dateCreated", "dateModified", "endDate", "reviewOpened", "startDate"] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Appraisal is not found" } };
                        break;
                    }
                    case "getAppraisals": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/appraisals";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        if (additionalFields["pageSize"] !== undefined)
                            qs["pageSize"] = additionalFields["pageSize"];
                        if (additionalFields["page"] !== undefined)
                            qs["page"] = additionalFields["page"];
                        if (additionalFields["textSearch"] !== undefined)
                            qs["textSearch"] = additionalFields["textSearch"];
                        if (additionalFields["startDateMinimum"] !== undefined)
                            qs["startDateMinimum"] = additionalFields["startDateMinimum"];
                        if (additionalFields["startDateMaximum"] !== undefined)
                            qs["startDateMaximum"] = additionalFields["startDateMaximum"];
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links", "total"], simplified: ["_embedded", "_links", "total"] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "409": { "title": "Conflict. If data is invalid." } };
                        break;
                    }
                    case "getFeedbackActionPlanReport": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/feedback-action-plan";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{appraisalId}").join(encodeURIComponent(String(this.getNodeParameter("appraisalId", itemIndex))));
                        if (additionalFields["accept"] !== undefined)
                            headers["accept"] = additionalFields["accept"];
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, headers: { ...headers }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Report is not found" } };
                        break;
                    }
                    case "getFeedbackCommentsReport": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/feedback-comments";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{appraisalId}").join(encodeURIComponent(String(this.getNodeParameter("appraisalId", itemIndex))));
                        if (additionalFields["accept"] !== undefined)
                            headers["accept"] = additionalFields["accept"];
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, headers: { ...headers }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Report is not found" } };
                        break;
                    }
                    case "getFeedbackDatabaseResponses": {
                        let path = "/api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/feedback-database-responses";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{appraisalId}").join(encodeURIComponent(String(this.getNodeParameter("appraisalId", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Report is not found" } };
                        break;
                    }
                    case "getFeedbackDetailReport": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/feedback-detail";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{appraisalId}").join(encodeURIComponent(String(this.getNodeParameter("appraisalId", itemIndex))));
                        if (additionalFields["accept"] !== undefined)
                            headers["accept"] = additionalFields["accept"];
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, headers: { ...headers }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Report is not found" } };
                        break;
                    }
                    case "getFeedbackGroupDetailReport": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/feedback-group-detail";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{appraisalId}").join(encodeURIComponent(String(this.getNodeParameter("appraisalId", itemIndex))));
                        if (additionalFields["accept"] !== undefined)
                            headers["accept"] = additionalFields["accept"];
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, headers: { ...headers }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Report is not found" } };
                        break;
                    }
                    case "getFeedbackReport": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/feedback-reports/{employeeId}";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{appraisalId}").join(encodeURIComponent(String(this.getNodeParameter("appraisalId", itemIndex))));
                        path = path.split("{employeeId}").join(encodeURIComponent(String(this.getNodeParameter("employeeId", itemIndex))));
                        if (additionalFields["alt"] !== undefined)
                            qs["alt"] = additionalFields["alt"];
                        if (additionalFields["accept"] !== undefined)
                            headers["accept"] = additionalFields["accept"];
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, headers: { ...headers }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links", "age", "gap", "gender", "grade", "hasReport", "percentageAchievedCompetences", "percentageAchievedIndicators", "percentageAchievedObjectives", "positionCode", "positionId", "review", "score", "seniority", "surveys", "surveysCompleted"], simplified: ["age", "gap", "gender", "grade", "hasReport", "percentageAchievedCompetences", "percentageAchievedIndicators", "percentageAchievedObjectives", "positionCode", "positionId"] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Report is not found" } };
                        break;
                    }
                    case "getFeedbackReports": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/feedback-reports";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{appraisalId}").join(encodeURIComponent(String(this.getNodeParameter("appraisalId", itemIndex))));
                        if (additionalFields["pageSize"] !== undefined)
                            qs["pageSize"] = additionalFields["pageSize"];
                        if (additionalFields["page"] !== undefined)
                            qs["page"] = additionalFields["page"];
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links", "total"], simplified: ["_embedded", "_links", "total"] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Appraisal is not found" } };
                        break;
                    }
                    case "getFeedbackResultsAgeReport": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/feedback-results-age";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{appraisalId}").join(encodeURIComponent(String(this.getNodeParameter("appraisalId", itemIndex))));
                        if (additionalFields["accept"] !== undefined)
                            headers["accept"] = additionalFields["accept"];
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, headers: { ...headers }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Report is not found" } };
                        break;
                    }
                    case "getFeedbackResultsAntiquityReport": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/feedback-results-antiquity";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{appraisalId}").join(encodeURIComponent(String(this.getNodeParameter("appraisalId", itemIndex))));
                        if (additionalFields["accept"] !== undefined)
                            headers["accept"] = additionalFields["accept"];
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, headers: { ...headers }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Report is not found" } };
                        break;
                    }
                    case "getFeedbackResultsGenderReport": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/feedback-results-gender";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{appraisalId}").join(encodeURIComponent(String(this.getNodeParameter("appraisalId", itemIndex))));
                        if (additionalFields["accept"] !== undefined)
                            headers["accept"] = additionalFields["accept"];
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, headers: { ...headers }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Report is not found" } };
                        break;
                    }
                    case "getFeedbackResultsJobsReport": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/feedback-results-jobs";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{appraisalId}").join(encodeURIComponent(String(this.getNodeParameter("appraisalId", itemIndex))));
                        if (additionalFields["accept"] !== undefined)
                            headers["accept"] = additionalFields["accept"];
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, headers: { ...headers }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Report is not found" } };
                        break;
                    }
                    case "getFeedbackResultsReport": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/feedback-results";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{appraisalId}").join(encodeURIComponent(String(this.getNodeParameter("appraisalId", itemIndex))));
                        if (additionalFields["accept"] !== undefined)
                            headers["accept"] = additionalFields["accept"];
                        if (additionalFields["includeGroupsScores"] !== undefined)
                            qs["includeGroupsScores"] = additionalFields["includeGroupsScores"];
                        if (additionalFields["includeRoleScores"] !== undefined)
                            qs["includeRoleScores"] = additionalFields["includeRoleScores"];
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, headers: { ...headers }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Report is not found" } };
                        break;
                    }
                    case "getInvitation": {
                        let path = "/api/v1/companies/{companyId}/appraisals/{appraisalId}/invitations/{employeeId}";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{appraisalId}").join(encodeURIComponent(String(this.getNodeParameter("appraisalId", itemIndex))));
                        path = path.split("{employeeId}").join(encodeURIComponent(String(this.getNodeParameter("employeeId", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links", "accessCode", "deadlineDate", "emailReadDate", "emailStatus", "errorMessage", "key", "lastEmailDate", "lastReviewEmailDate", "nextEmailDate", "nextReviewEmailDate", "reviewEmailReadDate", "reviewEmailStatus", "state", "surveysAsSupervisorNumber", "surveysCompleted", "surveysNumber", "surveysReviewedNumber"], simplified: ["accessCode", "deadlineDate", "emailReadDate", "emailStatus", "errorMessage", "key", "lastEmailDate", "lastReviewEmailDate", "nextEmailDate", "nextReviewEmailDate"] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Invitation is not found" } };
                        break;
                    }
                    case "getInvitations": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/appraisals/{appraisalId}/invitations";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{appraisalId}").join(encodeURIComponent(String(this.getNodeParameter("appraisalId", itemIndex))));
                        if (additionalFields["pageSize"] !== undefined)
                            qs["pageSize"] = additionalFields["pageSize"];
                        if (additionalFields["page"] !== undefined)
                            qs["page"] = additionalFields["page"];
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links", "total"], simplified: ["_embedded", "_links", "total"] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Appraisal is not found" }, "409": { "title": "Conflict. If data is invalid." } };
                        break;
                    }
                    case "getNBoxResultsReport": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/nbox-results";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{appraisalId}").join(encodeURIComponent(String(this.getNodeParameter("appraisalId", itemIndex))));
                        if (additionalFields["accept"] !== undefined)
                            headers["accept"] = additionalFields["accept"];
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, headers: { ...headers }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Report is not found" } };
                        break;
                    }
                    case "getReports": {
                        let path = "/api/v1/companies/{companyId}/appraisals/{appraisalId}/reports";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{appraisalId}").join(encodeURIComponent(String(this.getNodeParameter("appraisalId", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links"], simplified: ["_embedded", "_links"] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Appraisal is not found" } };
                        break;
                    }
                    case "getSurveyListReport": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/survey-list";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{appraisalId}").join(encodeURIComponent(String(this.getNodeParameter("appraisalId", itemIndex))));
                        if (additionalFields["accept"] !== undefined)
                            headers["accept"] = additionalFields["accept"];
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, headers: { ...headers }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Report is not found" } };
                        break;
                    }
                    case "getWorkingEnvAgeGenderReport": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/work-env-age-gender";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{appraisalId}").join(encodeURIComponent(String(this.getNodeParameter("appraisalId", itemIndex))));
                        if (additionalFields["accept"] !== undefined)
                            headers["accept"] = additionalFields["accept"];
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, headers: { ...headers }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Report is not found" } };
                        break;
                    }
                    case "getWorkingEnvAllReport": {
                        let path = "/api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/work-env-all";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{appraisalId}").join(encodeURIComponent(String(this.getNodeParameter("appraisalId", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Report is not found" } };
                        break;
                    }
                    case "getWorkingEnvAntiquityReport": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/work-env-antiquity";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{appraisalId}").join(encodeURIComponent(String(this.getNodeParameter("appraisalId", itemIndex))));
                        if (additionalFields["accept"] !== undefined)
                            headers["accept"] = additionalFields["accept"];
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, headers: { ...headers }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Report is not found" } };
                        break;
                    }
                    case "getWorkingEnvDeptsReport": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/work-env-departments";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{appraisalId}").join(encodeURIComponent(String(this.getNodeParameter("appraisalId", itemIndex))));
                        if (additionalFields["accept"] !== undefined)
                            headers["accept"] = additionalFields["accept"];
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, headers: { ...headers }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Report is not found" } };
                        break;
                    }
                    case "getWorkingEnvGroupsReport": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/work-env-groups";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{appraisalId}").join(encodeURIComponent(String(this.getNodeParameter("appraisalId", itemIndex))));
                        if (additionalFields["accept"] !== undefined)
                            headers["accept"] = additionalFields["accept"];
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, headers: { ...headers }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Report is not found" } };
                        break;
                    }
                    case "getWorkingEnvIndicatorsReport": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/work-env-indicators";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{appraisalId}").join(encodeURIComponent(String(this.getNodeParameter("appraisalId", itemIndex))));
                        if (additionalFields["accept"] !== undefined)
                            headers["accept"] = additionalFields["accept"];
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, headers: { ...headers }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Report is not found" } };
                        break;
                    }
                    case "getWorkingEnvJobsReport": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/work-env-jobs";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{appraisalId}").join(encodeURIComponent(String(this.getNodeParameter("appraisalId", itemIndex))));
                        if (additionalFields["accept"] !== undefined)
                            headers["accept"] = additionalFields["accept"];
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, headers: { ...headers }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Report is not found" } };
                        break;
                    }
                    case "getWorkingEnvironmentFeedbackReport": {
                        let path = "/api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/work-env-feedback";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{appraisalId}").join(encodeURIComponent(String(this.getNodeParameter("appraisalId", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Report is not found" } };
                        break;
                    }
                    case "getWorkingEnvironmentReport": {
                        let path = "/api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/work-env";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{appraisalId}").join(encodeURIComponent(String(this.getNodeParameter("appraisalId", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Report is not found" } };
                        break;
                    }
                    case "resendInvitation": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/appraisals/{appraisalId}/invitations/{employeeId}/resend";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{appraisalId}").join(encodeURIComponent(String(this.getNodeParameter("appraisalId", itemIndex))));
                        path = path.split("{employeeId}").join(encodeURIComponent(String(this.getNodeParameter("employeeId", itemIndex))));
                        if (additionalFields["sendDate"] !== undefined)
                            qs["sendDate"] = additionalFields["sendDate"];
                        if (additionalFields["deadlineDate"] !== undefined)
                            qs["deadlineDate"] = additionalFields["deadlineDate"];
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "PUT", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Invitation is not found" }, "409": { "title": "Data Conflict. When the appraisal is closed and revision isn't enabled." } };
                        break;
                    }
                    case "createCompany": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/api/v1/companies";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["_embedded"] !== undefined)
                            setBodyField(body, { "name": "_embedded", "displayName": "Embedded", "description": "CompanyEmbedded", "type": "object", "representation": "raw", "fields": [{ "name": "administrators", "displayName": "Administrators", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "description": "Simplified Administrator object with the most important data", "type": "object", "representation": "raw", "fields": [{ "name": "email", "displayName": "Email", "description": "Administrator's email", "type": "string" }, { "name": "id", "displayName": "Id", "description": "Administrator's ID", "type": "integer", "format": "int64" }, { "name": "name", "displayName": "Name", "description": "Administrator's name", "type": "string" }] } }, { "name": "logo", "displayName": "Logo", "description": "Simplified File object with the most important data.", "type": "object", "representation": "raw", "fields": [{ "name": "id", "displayName": "Id", "description": "File ID", "type": "integer", "format": "int64" }] }] }, additionalFields["_embedded"], this, itemIndex);
                        if (additionalFields["_links"] !== undefined)
                            setBodyField(body, { "name": "_links", "displayName": "Links", "description": "CompanyLinks", "type": "object", "representation": "raw", "fields": [{ "name": "administrators", "displayName": "Administrators", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "appraisals", "displayName": "Appraisals", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "departments", "displayName": "Departments", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "employees", "displayName": "Employees", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "logo", "displayName": "Logo", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "logoContent", "displayName": "Logo Content", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "self", "displayName": "Self", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }] }, additionalFields["_links"], this, itemIndex);
                        if (additionalFields["address"] !== undefined)
                            setBodyField(body, { "name": "address", "displayName": "Address", "description": "Company address.", "type": "string" }, additionalFields["address"], this, itemIndex);
                        if (additionalFields["dateCreated"] !== undefined)
                            setBodyField(body, { "name": "dateCreated", "displayName": "Date Created", "description": "Date the company was created.", "type": "string" }, additionalFields["dateCreated"], this, itemIndex);
                        if (additionalFields["dateModified"] !== undefined)
                            setBodyField(body, { "name": "dateModified", "displayName": "Date Modified", "description": "Date the company was last modified.", "type": "string" }, additionalFields["dateModified"], this, itemIndex);
                        if (additionalFields["id"] !== undefined)
                            setBodyField(body, { "name": "id", "displayName": "Id", "description": "Company ID.", "type": "integer", "format": "int64" }, additionalFields["id"], this, itemIndex);
                        if (additionalFields["language"] !== undefined)
                            setBodyField(body, { "name": "language", "displayName": "Language", "description": "Company language code.", "type": "string", "enum": ["es", "en", "ca", "fr", "pt", "it", "de"] }, additionalFields["language"], this, itemIndex);
                        if (additionalFields["limit"] !== undefined)
                            setBodyField(body, { "name": "limit", "displayName": "Limit", "description": "Maximum number of employee licenses assigned to the company.", "type": "integer", "format": "int32" }, additionalFields["limit"], this, itemIndex);
                        if (additionalFields["name"] !== undefined)
                            setBodyField(body, { "name": "name", "displayName": "Name", "description": "Company name.", "type": "string" }, additionalFields["name"], this, itemIndex);
                        if (additionalFields["state"] !== undefined)
                            setBodyField(body, { "name": "state", "displayName": "State", "description": "Company status.", "type": "string", "enum": ["active", "locked"] }, additionalFields["state"], this, itemIndex);
                        if (additionalFields["taxIdNumber"] !== undefined)
                            setBodyField(body, { "name": "taxIdNumber", "displayName": "Tax Id Number", "description": "Company tax identification number.", "type": "string" }, additionalFields["taxIdNumber"], this, itemIndex);
                        if (additionalFields["timeZone"] !== undefined)
                            setBodyField(body, { "name": "timeZone", "displayName": "Time Zone", "description": "Company time zone.", "type": "string" }, additionalFields["timeZone"], this, itemIndex);
                        if (additionalFields["used"] !== undefined)
                            setBodyField(body, { "name": "used", "displayName": "Used", "description": "Number of employee licenses currently in use.", "type": "integer", "format": "int32" }, additionalFields["used"], this, itemIndex);
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links", "address", "dateCreated", "dateModified", "id", "language", "limit", "name", "state", "taxIdNumber", "timeZone", "used"], simplified: ["id", "name", "address", "dateCreated", "dateModified", "language", "limit", "state", "taxIdNumber", "timeZone"] };
                        errorPlan = { "400": { "title": "Bad request. If company data is inavlid" }, "401": { "title": "Unauthorised" }, "403": { "title": "Forbidden. If insufficient permissions" }, "409": { "title": "Conflict. If data is invalid." } };
                        break;
                    }
                    case "deleteCompany": {
                        let path = "/api/v1/companies/{id}";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "401": { "title": "Unauthorised" }, "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If company is not found" } };
                        break;
                    }
                    case "deleteCompanyLogo": {
                        let path = "/api/v1/companies/{id}/logo";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "401": { "title": "Unauthorised" }, "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If company is not found" } };
                        break;
                    }
                    case "getAdministrators_1": {
                        let path = "/api/v1/companies/{id}/administrators";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "301": { "title": "Moved permanently. Moved to '/administrators?companyId={id}'" }, "401": { "title": "Unauthorised" } };
                        break;
                    }
                    case "getCompanies_1": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/api/v1/companies";
                        const qs = {};
                        const body = {};
                        if (additionalFields["administratorId"] !== undefined)
                            qs["administratorId"] = additionalFields["administratorId"];
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links"], simplified: ["_embedded", "_links"] };
                        errorPlan = { "401": { "title": "Unauthorised" }, "409": { "title": "Conflict. If data is invalid." } };
                        break;
                    }
                    case "getCompany": {
                        let path = "/api/v1/companies/{id}";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links", "address", "dateCreated", "dateModified", "id", "language", "limit", "name", "state", "taxIdNumber", "timeZone", "used"], simplified: ["id", "name", "address", "dateCreated", "dateModified", "language", "limit", "state", "taxIdNumber", "timeZone"] };
                        errorPlan = { "401": { "title": "Unauthorised" }, "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Company is not found" } };
                        break;
                    }
                    case "getCompanyLogo": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{id}/logo";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["alt"] !== undefined)
                            qs["alt"] = additionalFields["alt"];
                        if (additionalFields["accept"] !== undefined)
                            headers["accept"] = additionalFields["accept"];
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, headers: { ...headers }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links", "dateCreated", "dateModified", "height", "id", "mimeType", "name", "size", "width"], simplified: ["_embedded", "_links", "dateCreated", "dateModified", "height", "id", "mimeType", "name", "size", "width"] };
                        errorPlan = { "401": { "title": "Unauthorised" }, "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If company is not found" } };
                        break;
                    }
                    case "relateAdministrators": {
                        let path = "/api/v1/companies/{id}/administrators";
                        const qs = {};
                        const headers = {};
                        let body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        body = normalizeParameterValue(this.getNodeParameter("bodyJson", itemIndex));
                        validateBodyValue(body, { "name": "bodyJson", "displayName": "Body", "type": "string", "required": true, "description": "Raw request body", "representation": "raw" }, "Body", this, itemIndex);
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "PUT", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "text/uri-list" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "401": { "title": "Unauthorised" }, "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If company is not found" }, "409": { "title": "Conflict. If data is invalid, e.g. any Administrator URI is not found" } };
                        break;
                    }
                    case "setCompanyLogo": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{id}/logo";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["data"] !== undefined)
                            setBodyField(body, { "name": "data", "displayName": "Data", "description": "Image file to upload.", "type": "object", "representation": "raw" }, additionalFields["data"], this, itemIndex);
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, body: toFormData(body), json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links", "dateCreated", "dateModified", "height", "id", "mimeType", "name", "size", "width"], simplified: ["_embedded", "_links", "dateCreated", "dateModified", "height", "id", "mimeType", "name", "size", "width"] };
                        errorPlan = { "401": { "title": "Unauthorised" }, "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If company is not found" } };
                        break;
                    }
                    case "unrelateAdministrators": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{id}/administrators";
                        const qs = {};
                        const headers = {};
                        let body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["bodyJson"] !== undefined) {
                            body = normalizeParameterValue(additionalFields["bodyJson"]);
                            validateBodyValue(body, { "name": "bodyJson", "displayName": "Body", "type": "string", "description": "Raw request body", "representation": "raw" }, "Body", this, itemIndex);
                        }
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "text/uri-list" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "401": { "title": "Unauthorised" }, "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If company is not found" }, "409": { "title": "Conflict. If data is invalid, e.g. any Administrator URI is not found" } };
                        break;
                    }
                    case "updateCompany": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{id}";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["_embedded"] !== undefined)
                            setBodyField(body, { "name": "_embedded", "displayName": "Embedded", "description": "CompanyEmbedded", "type": "object", "representation": "raw", "fields": [{ "name": "administrators", "displayName": "Administrators", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "description": "Simplified Administrator object with the most important data", "type": "object", "representation": "raw", "fields": [{ "name": "email", "displayName": "Email", "description": "Administrator's email", "type": "string" }, { "name": "id", "displayName": "Id", "description": "Administrator's ID", "type": "integer", "format": "int64" }, { "name": "name", "displayName": "Name", "description": "Administrator's name", "type": "string" }] } }, { "name": "logo", "displayName": "Logo", "description": "Simplified File object with the most important data.", "type": "object", "representation": "raw", "fields": [{ "name": "id", "displayName": "Id", "description": "File ID", "type": "integer", "format": "int64" }] }] }, additionalFields["_embedded"], this, itemIndex);
                        if (additionalFields["_links"] !== undefined)
                            setBodyField(body, { "name": "_links", "displayName": "Links", "description": "CompanyLinks", "type": "object", "representation": "raw", "fields": [{ "name": "administrators", "displayName": "Administrators", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "appraisals", "displayName": "Appraisals", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "departments", "displayName": "Departments", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "employees", "displayName": "Employees", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "logo", "displayName": "Logo", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "logoContent", "displayName": "Logo Content", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "self", "displayName": "Self", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }] }, additionalFields["_links"], this, itemIndex);
                        if (additionalFields["address"] !== undefined)
                            setBodyField(body, { "name": "address", "displayName": "Address", "description": "Company address.", "type": "string" }, additionalFields["address"], this, itemIndex);
                        if (additionalFields["dateCreated"] !== undefined)
                            setBodyField(body, { "name": "dateCreated", "displayName": "Date Created", "description": "Date the company was created.", "type": "string" }, additionalFields["dateCreated"], this, itemIndex);
                        if (additionalFields["dateModified"] !== undefined)
                            setBodyField(body, { "name": "dateModified", "displayName": "Date Modified", "description": "Date the company was last modified.", "type": "string" }, additionalFields["dateModified"], this, itemIndex);
                        if (additionalFields["idBody"] !== undefined)
                            setBodyField(body, { "name": "id", "displayName": "Id", "description": "Company ID.", "type": "integer", "format": "int64" }, additionalFields["idBody"], this, itemIndex);
                        if (additionalFields["language"] !== undefined)
                            setBodyField(body, { "name": "language", "displayName": "Language", "description": "Company language code.", "type": "string", "enum": ["es", "en", "ca", "fr", "pt", "it", "de"] }, additionalFields["language"], this, itemIndex);
                        if (additionalFields["limit"] !== undefined)
                            setBodyField(body, { "name": "limit", "displayName": "Limit", "description": "Maximum number of employee licenses assigned to the company.", "type": "integer", "format": "int32" }, additionalFields["limit"], this, itemIndex);
                        if (additionalFields["name"] !== undefined)
                            setBodyField(body, { "name": "name", "displayName": "Name", "description": "Company name.", "type": "string" }, additionalFields["name"], this, itemIndex);
                        if (additionalFields["state"] !== undefined)
                            setBodyField(body, { "name": "state", "displayName": "State", "description": "Company status.", "type": "string", "enum": ["active", "locked"] }, additionalFields["state"], this, itemIndex);
                        if (additionalFields["taxIdNumber"] !== undefined)
                            setBodyField(body, { "name": "taxIdNumber", "displayName": "Tax Id Number", "description": "Company tax identification number.", "type": "string" }, additionalFields["taxIdNumber"], this, itemIndex);
                        if (additionalFields["timeZone"] !== undefined)
                            setBodyField(body, { "name": "timeZone", "displayName": "Time Zone", "description": "Company time zone.", "type": "string" }, additionalFields["timeZone"], this, itemIndex);
                        if (additionalFields["used"] !== undefined)
                            setBodyField(body, { "name": "used", "displayName": "Used", "description": "Number of employee licenses currently in use.", "type": "integer", "format": "int32" }, additionalFields["used"], this, itemIndex);
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "PUT", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links", "address", "dateCreated", "dateModified", "id", "language", "limit", "name", "state", "taxIdNumber", "timeZone", "used"], simplified: ["id", "name", "address", "dateCreated", "dateModified", "language", "limit", "state", "taxIdNumber", "timeZone"] };
                        errorPlan = { "401": { "title": "Unauthorised" }, "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If company is not found" }, "409": { "title": "Conflict. If the data is invalid." } };
                        break;
                    }
                    case "createDepartment": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/departments";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        if (additionalFields["_embedded"] !== undefined)
                            setBodyField(body, { "name": "_embedded", "displayName": "Embedded", "description": "DepartmentEmbedded", "type": "object", "representation": "raw", "fields": [{ "name": "company", "displayName": "Company", "description": "Simplified Company object with the most important data", "type": "object", "representation": "raw", "fields": [{ "name": "id", "displayName": "Id", "description": "Company ID", "type": "integer", "format": "int64" }, { "name": "name", "displayName": "Name", "description": "Company name", "type": "string" }] }, { "name": "parent", "displayName": "Parent", "description": "Simplified Department object with the most important data.", "type": "object", "representation": "raw", "fields": [{ "name": "code", "displayName": "Code", "description": "Department code", "type": "string" }, { "name": "id", "displayName": "Id", "description": "Department ID", "type": "integer", "format": "int64" }, { "name": "name", "displayName": "Name", "description": "Department name", "type": "string" }] }, { "name": "positions", "displayName": "Positions", "description": "List of job positions that a department has", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "description": "Simplified Position object with the most important data", "type": "object", "representation": "raw", "fields": [{ "name": "code", "displayName": "Code", "description": "Position's code", "type": "string" }, { "name": "id", "displayName": "Id", "description": "Position's ID", "type": "integer", "format": "int64" }, { "name": "name", "displayName": "Name", "description": "Position's name", "type": "string" }] } }] }, additionalFields["_embedded"], this, itemIndex);
                        if (additionalFields["_links"] !== undefined)
                            setBodyField(body, { "name": "_links", "displayName": "Links", "description": "DepartmentLinks", "type": "object", "representation": "raw", "fields": [{ "name": "children", "displayName": "Children", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "company", "displayName": "Company", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "parent", "displayName": "Parent", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "positions", "displayName": "Positions", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "self", "displayName": "Self", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }] }, additionalFields["_links"], this, itemIndex);
                        if (additionalFields["code"] !== undefined)
                            setBodyField(body, { "name": "code", "displayName": "Code", "description": "Department code.", "type": "string" }, additionalFields["code"], this, itemIndex);
                        if (additionalFields["dateCreated"] !== undefined)
                            setBodyField(body, { "name": "dateCreated", "displayName": "Date Created", "description": "Date the department was created.", "type": "string" }, additionalFields["dateCreated"], this, itemIndex);
                        if (additionalFields["dateModified"] !== undefined)
                            setBodyField(body, { "name": "dateModified", "displayName": "Date Modified", "description": "Date the department was last modified.", "type": "string" }, additionalFields["dateModified"], this, itemIndex);
                        if (additionalFields["id"] !== undefined)
                            setBodyField(body, { "name": "id", "displayName": "Id", "description": "Department ID.", "type": "integer", "format": "int64" }, additionalFields["id"], this, itemIndex);
                        if (additionalFields["name"] !== undefined)
                            setBodyField(body, { "name": "name", "displayName": "Name", "description": "Department name.", "type": "string" }, additionalFields["name"], this, itemIndex);
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links", "code", "dateCreated", "dateModified", "id", "name"], simplified: ["_embedded", "_links", "code", "dateCreated", "dateModified", "id", "name"] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If company is not found" }, "409": { "title": "Conflict. If data is invalid." } };
                        break;
                    }
                    case "createPosition": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/departments/{departmentId}/positions";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{departmentId}").join(encodeURIComponent(String(this.getNodeParameter("departmentId", itemIndex))));
                        if (additionalFields["_embedded"] !== undefined)
                            setBodyField(body, { "name": "_embedded", "displayName": "Embedded", "description": "PositionEmbedded", "type": "object", "representation": "raw", "fields": [{ "name": "department", "displayName": "Department", "description": "Simplified Department object with the most important data.", "type": "object", "representation": "raw", "fields": [{ "name": "code", "displayName": "Code", "description": "Department code", "type": "string" }, { "name": "id", "displayName": "Id", "description": "Department ID", "type": "integer", "format": "int64" }, { "name": "name", "displayName": "Name", "description": "Department name", "type": "string" }] }] }, additionalFields["_embedded"], this, itemIndex);
                        if (additionalFields["_links"] !== undefined)
                            setBodyField(body, { "name": "_links", "displayName": "Links", "description": "PositionLinks", "type": "object", "representation": "raw", "fields": [{ "name": "department", "displayName": "Department", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "employees", "displayName": "Employees", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "move", "displayName": "Move", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "self", "displayName": "Self", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }] }, additionalFields["_links"], this, itemIndex);
                        if (additionalFields["code"] !== undefined)
                            setBodyField(body, { "name": "code", "displayName": "Code", "description": "Job position code.", "type": "string" }, additionalFields["code"], this, itemIndex);
                        if (additionalFields["dateCreated"] !== undefined)
                            setBodyField(body, { "name": "dateCreated", "displayName": "Date Created", "description": "Date the job position was created.", "type": "string" }, additionalFields["dateCreated"], this, itemIndex);
                        if (additionalFields["dateModified"] !== undefined)
                            setBodyField(body, { "name": "dateModified", "displayName": "Date Modified", "description": "Date the job position was last modified.", "type": "string" }, additionalFields["dateModified"], this, itemIndex);
                        if (additionalFields["enrolled"] !== undefined)
                            setBodyField(body, { "name": "enrolled", "displayName": "Enrolled", "description": "Number of employees assigned to the position.", "type": "integer", "format": "int32" }, additionalFields["enrolled"], this, itemIndex);
                        if (additionalFields["id"] !== undefined)
                            setBodyField(body, { "name": "id", "displayName": "Id", "description": "Job position ID.", "type": "integer", "format": "int64" }, additionalFields["id"], this, itemIndex);
                        if (additionalFields["name"] !== undefined)
                            setBodyField(body, { "name": "name", "displayName": "Name", "description": "Job position name.", "type": "string" }, additionalFields["name"], this, itemIndex);
                        if (additionalFields["required"] !== undefined)
                            setBodyField(body, { "name": "required", "displayName": "Required", "description": "Number of employees needed for the position.", "type": "integer", "format": "int32" }, additionalFields["required"], this, itemIndex);
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links", "code", "dateCreated", "dateModified", "enrolled", "id", "name", "required"], simplified: ["_embedded", "_links", "code", "dateCreated", "dateModified", "enrolled", "id", "name", "required"] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Department is not found" } };
                        break;
                    }
                    case "deleteDepartment": {
                        let path = "/api/v1/companies/{companyId}/departments/{id}";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Department is not found" } };
                        break;
                    }
                    case "deleteEmployees": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/departments/{departmentId}/positions/{positionId}/employees";
                        const qs = {};
                        const headers = {};
                        let body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{departmentId}").join(encodeURIComponent(String(this.getNodeParameter("departmentId", itemIndex))));
                        path = path.split("{positionId}").join(encodeURIComponent(String(this.getNodeParameter("positionId", itemIndex))));
                        if (additionalFields["bodyJson"] !== undefined) {
                            body = normalizeParameterValue(additionalFields["bodyJson"]);
                            validateBodyValue(body, { "name": "bodyJson", "displayName": "Body", "type": "string", "description": "Raw request body", "representation": "raw" }, "Body", this, itemIndex);
                        }
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "text/uri-list" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If position is not found" }, "409": { "title": "Conflict. If data is invalid, e.g. any Employee URI is not found" } };
                        break;
                    }
                    case "deletePosition": {
                        let path = "/api/v1/companies/{companyId}/departments/{departmentId}/positions/{positionId}";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{departmentId}").join(encodeURIComponent(String(this.getNodeParameter("departmentId", itemIndex))));
                        path = path.split("{positionId}").join(encodeURIComponent(String(this.getNodeParameter("positionId", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If position is not found" } };
                        break;
                    }
                    case "getChildren": {
                        let path = "/api/v1/companies/{companyId}/departments/{departmentId}/children";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{departmentId}").join(encodeURIComponent(String(this.getNodeParameter("departmentId", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "301": { "title": "Moved permanently. Moved to '/companies/{companyId}/departments?parentId={departmentParentId}'" }, "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Department o the parent is not found" } };
                        break;
                    }
                    case "getDepartment": {
                        let path = "/api/v1/companies/{companyId}/departments/{departmentId}";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{departmentId}").join(encodeURIComponent(String(this.getNodeParameter("departmentId", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links", "code", "dateCreated", "dateModified", "id", "name"], simplified: ["_embedded", "_links", "code", "dateCreated", "dateModified", "id", "name"] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Department is not found" } };
                        break;
                    }
                    case "getDepartments": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/departments";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        if (additionalFields["parentId"] !== undefined)
                            qs["parentId"] = additionalFields["parentId"];
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links"], simplified: ["_embedded", "_links"] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If company is not found" } };
                        break;
                    }
                    case "getEmployees": {
                        let path = "/api/v1/companies/{companyId}/departments/{departmentId}/positions/{positionId}/employees";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{departmentId}").join(encodeURIComponent(String(this.getNodeParameter("departmentId", itemIndex))));
                        path = path.split("{positionId}").join(encodeURIComponent(String(this.getNodeParameter("positionId", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "301": { "title": "Moved permanently. Moved to '/companies/{companyId}/employees?positionId={id}'" } };
                        break;
                    }
                    case "getParent": {
                        let path = "/api/v1/companies/{companyId}/departments/{departmentId}/parent";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{departmentId}").join(encodeURIComponent(String(this.getNodeParameter("departmentId", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "301": { "title": "Moved permanently. Moved to '/companies/{companyId}/departments/{departmentParentId}'" }, "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Department o the parent is not found" } };
                        break;
                    }
                    case "getPosition": {
                        let path = "/api/v1/companies/{companyId}/departments/{departmentId}/positions/{positionId}";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{departmentId}").join(encodeURIComponent(String(this.getNodeParameter("departmentId", itemIndex))));
                        path = path.split("{positionId}").join(encodeURIComponent(String(this.getNodeParameter("positionId", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links", "code", "dateCreated", "dateModified", "enrolled", "id", "name", "required"], simplified: ["_embedded", "_links", "code", "dateCreated", "dateModified", "enrolled", "id", "name", "required"] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Position is not found" } };
                        break;
                    }
                    case "getPositions": {
                        let path = "/api/v1/companies/{companyId}/departments/{departmentId}/positions";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{departmentId}").join(encodeURIComponent(String(this.getNodeParameter("departmentId", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links"], simplified: ["_embedded", "_links"] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Department is not found" } };
                        break;
                    }
                    case "movePosition": {
                        let path = "/api/v1/companies/{companyId}/departments/{departmentId}/positions/{positionId}/move";
                        const qs = {};
                        const headers = {};
                        let body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{departmentId}").join(encodeURIComponent(String(this.getNodeParameter("departmentId", itemIndex))));
                        path = path.split("{positionId}").join(encodeURIComponent(String(this.getNodeParameter("positionId", itemIndex))));
                        body = normalizeParameterValue(this.getNodeParameter("bodyJson", itemIndex));
                        validateBodyValue(body, { "name": "bodyJson", "displayName": "Body", "type": "string", "required": true, "description": "Raw request body", "representation": "raw" }, "Body", this, itemIndex);
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "PUT", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "text/uri-list" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If position is not found" }, "409": { "title": "Conflict. If data is invalid, e.g. Department URI is invalid" } };
                        break;
                    }
                    case "setEmployees": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/departments/{departmentId}/positions/{positionId}/employees";
                        const qs = {};
                        const headers = {};
                        let body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{departmentId}").join(encodeURIComponent(String(this.getNodeParameter("departmentId", itemIndex))));
                        path = path.split("{positionId}").join(encodeURIComponent(String(this.getNodeParameter("positionId", itemIndex))));
                        if (additionalFields["bodyJson"] !== undefined) {
                            body = normalizeParameterValue(additionalFields["bodyJson"]);
                            validateBodyValue(body, { "name": "bodyJson", "displayName": "Body", "type": "string", "description": "Raw request body", "representation": "raw" }, "Body", this, itemIndex);
                        }
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "PUT", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "text/uri-list" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If position is not found" }, "409": { "title": "Conflict. If data is invalid, e.g. any Employee URI is not found" } };
                        break;
                    }
                    case "setParent": {
                        let path = "/api/v1/companies/{companyId}/departments/{departmentId}/parent";
                        const qs = {};
                        const headers = {};
                        let body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{departmentId}").join(encodeURIComponent(String(this.getNodeParameter("departmentId", itemIndex))));
                        body = normalizeParameterValue(this.getNodeParameter("bodyJson", itemIndex));
                        validateBodyValue(body, { "name": "bodyJson", "displayName": "Body", "type": "string", "required": true, "description": "Raw request body", "representation": "raw" }, "Body", this, itemIndex);
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "PUT", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "text/uri-list" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Department is not found" }, "409": { "title": "Data conflict. If parent Department URI is invalid" } };
                        break;
                    }
                    case "updateDepartment": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/departments/{departmentId}";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{departmentId}").join(encodeURIComponent(String(this.getNodeParameter("departmentId", itemIndex))));
                        if (additionalFields["_embedded"] !== undefined)
                            setBodyField(body, { "name": "_embedded", "displayName": "Embedded", "description": "DepartmentEmbedded", "type": "object", "representation": "raw", "fields": [{ "name": "company", "displayName": "Company", "description": "Simplified Company object with the most important data", "type": "object", "representation": "raw", "fields": [{ "name": "id", "displayName": "Id", "description": "Company ID", "type": "integer", "format": "int64" }, { "name": "name", "displayName": "Name", "description": "Company name", "type": "string" }] }, { "name": "parent", "displayName": "Parent", "description": "Simplified Department object with the most important data.", "type": "object", "representation": "raw", "fields": [{ "name": "code", "displayName": "Code", "description": "Department code", "type": "string" }, { "name": "id", "displayName": "Id", "description": "Department ID", "type": "integer", "format": "int64" }, { "name": "name", "displayName": "Name", "description": "Department name", "type": "string" }] }, { "name": "positions", "displayName": "Positions", "description": "List of job positions that a department has", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "description": "Simplified Position object with the most important data", "type": "object", "representation": "raw", "fields": [{ "name": "code", "displayName": "Code", "description": "Position's code", "type": "string" }, { "name": "id", "displayName": "Id", "description": "Position's ID", "type": "integer", "format": "int64" }, { "name": "name", "displayName": "Name", "description": "Position's name", "type": "string" }] } }] }, additionalFields["_embedded"], this, itemIndex);
                        if (additionalFields["_links"] !== undefined)
                            setBodyField(body, { "name": "_links", "displayName": "Links", "description": "DepartmentLinks", "type": "object", "representation": "raw", "fields": [{ "name": "children", "displayName": "Children", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "company", "displayName": "Company", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "parent", "displayName": "Parent", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "positions", "displayName": "Positions", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "self", "displayName": "Self", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }] }, additionalFields["_links"], this, itemIndex);
                        if (additionalFields["code"] !== undefined)
                            setBodyField(body, { "name": "code", "displayName": "Code", "description": "Department code.", "type": "string" }, additionalFields["code"], this, itemIndex);
                        if (additionalFields["dateCreated"] !== undefined)
                            setBodyField(body, { "name": "dateCreated", "displayName": "Date Created", "description": "Date the department was created.", "type": "string" }, additionalFields["dateCreated"], this, itemIndex);
                        if (additionalFields["dateModified"] !== undefined)
                            setBodyField(body, { "name": "dateModified", "displayName": "Date Modified", "description": "Date the department was last modified.", "type": "string" }, additionalFields["dateModified"], this, itemIndex);
                        if (additionalFields["id"] !== undefined)
                            setBodyField(body, { "name": "id", "displayName": "Id", "description": "Department ID.", "type": "integer", "format": "int64" }, additionalFields["id"], this, itemIndex);
                        if (additionalFields["name"] !== undefined)
                            setBodyField(body, { "name": "name", "displayName": "Name", "description": "Department name.", "type": "string" }, additionalFields["name"], this, itemIndex);
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "PUT", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links", "code", "dateCreated", "dateModified", "id", "name"], simplified: ["_embedded", "_links", "code", "dateCreated", "dateModified", "id", "name"] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Department is not found" }, "409": { "title": "Conflict. If data is invalid." } };
                        break;
                    }
                    case "createEmployee": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/employees";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        if (additionalFields["onArchived"] !== undefined)
                            qs["onArchived"] = additionalFields["onArchived"];
                        if (additionalFields["_embedded"] !== undefined)
                            setBodyField(body, { "name": "_embedded", "displayName": "Embedded", "description": "EmployeeEmbedded", "type": "object", "representation": "raw", "fields": [{ "name": "clients", "displayName": "Clients", "description": "List of employee's clients, if any", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "description": "Simplified Employee object with the most important data", "type": "object", "representation": "raw", "fields": [{ "name": "code", "displayName": "Code", "description": "Employee's code", "type": "string" }, { "name": "email", "displayName": "Email", "description": "Employee's email", "type": "string" }, { "name": "firstName", "displayName": "First Name", "description": "Employee's name", "type": "string" }, { "name": "id", "displayName": "Id", "description": "Employee's ID", "type": "integer", "format": "int64" }, { "name": "lastName", "displayName": "Last Name", "description": "Employee's last name or surname", "type": "string" }, { "name": "photo", "displayName": "Photo", "description": "Employee's photo ID", "type": "integer", "format": "int64" }] } }, { "name": "company", "displayName": "Company", "description": "Simplified Company object with the most important data", "type": "object", "representation": "raw", "fields": [{ "name": "id", "displayName": "Id", "description": "Company ID", "type": "integer", "format": "int64" }, { "name": "name", "displayName": "Name", "description": "Company name", "type": "string" }] }, { "name": "position", "displayName": "Position", "description": "Simplified Position object with the most important data", "type": "object", "representation": "raw", "fields": [{ "name": "code", "displayName": "Code", "description": "Position's code", "type": "string" }, { "name": "id", "displayName": "Id", "description": "Position's ID", "type": "integer", "format": "int64" }, { "name": "name", "displayName": "Name", "description": "Position's name", "type": "string" }] }, { "name": "supervisor", "displayName": "Supervisor", "description": "Simplified Employee object with the most important data", "type": "object", "representation": "raw", "fields": [{ "name": "code", "displayName": "Code", "description": "Employee's code", "type": "string" }, { "name": "email", "displayName": "Email", "description": "Employee's email", "type": "string" }, { "name": "firstName", "displayName": "First Name", "description": "Employee's name", "type": "string" }, { "name": "id", "displayName": "Id", "description": "Employee's ID", "type": "integer", "format": "int64" }, { "name": "lastName", "displayName": "Last Name", "description": "Employee's last name or surname", "type": "string" }, { "name": "photo", "displayName": "Photo", "description": "Employee's photo ID", "type": "integer", "format": "int64" }] }] }, additionalFields["_embedded"], this, itemIndex);
                        if (additionalFields["_links"] !== undefined)
                            setBodyField(body, { "name": "_links", "displayName": "Links", "description": "EmployeeLinks", "type": "object", "representation": "raw", "fields": [{ "name": "clients", "displayName": "Clients", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "company", "displayName": "Company", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "feedbackReports", "displayName": "Feedback Reports", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "photo", "displayName": "Photo", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "photoContent", "displayName": "Photo Content", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "position", "displayName": "Position", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "self", "displayName": "Self", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "subordinates", "displayName": "Subordinates", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "supervisor", "displayName": "Supervisor", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }] }, additionalFields["_links"], this, itemIndex);
                        if (additionalFields["address"] !== undefined)
                            setBodyField(body, { "name": "address", "displayName": "Address", "description": "Employee address.", "type": "string" }, additionalFields["address"], this, itemIndex);
                        if (additionalFields["birthDate"] !== undefined)
                            setBodyField(body, { "name": "birthDate", "displayName": "Birth Date", "description": "Employee date of birth.", "type": "string", "example": "2019-10-31T23:00Z" }, additionalFields["birthDate"], this, itemIndex);
                        if (additionalFields["city"] !== undefined)
                            setBodyField(body, { "name": "city", "displayName": "City", "description": "City.", "type": "string" }, additionalFields["city"], this, itemIndex);
                        setBodyField(body, { "name": "code", "displayName": "Code", "description": "Employee code.", "type": "string", "required": true }, this.getNodeParameter("code", itemIndex), this, itemIndex);
                        if (additionalFields["country"] !== undefined)
                            setBodyField(body, { "name": "country", "displayName": "Country", "description": "Country.", "type": "string" }, additionalFields["country"], this, itemIndex);
                        if (additionalFields["dateCreated"] !== undefined)
                            setBodyField(body, { "name": "dateCreated", "displayName": "Date Created", "description": "Date the employee record was created.", "type": "string" }, additionalFields["dateCreated"], this, itemIndex);
                        if (additionalFields["dateModified"] !== undefined)
                            setBodyField(body, { "name": "dateModified", "displayName": "Date Modified", "description": "Date the employee record was last modified.", "type": "string" }, additionalFields["dateModified"], this, itemIndex);
                        setBodyField(body, { "name": "email", "displayName": "Email", "description": "Email address.", "type": "string", "required": true }, this.getNodeParameter("email", itemIndex), this, itemIndex);
                        if (additionalFields["externalId"] !== undefined)
                            setBodyField(body, { "name": "externalId", "displayName": "External Id", "description": "External employee ID. Prefix it with `external-id=` when using it in an API path.", "type": "string", "example": "external-id=123" }, additionalFields["externalId"], this, itemIndex);
                        setBodyField(body, { "name": "firstName", "displayName": "First Name", "description": "First name.", "type": "string", "required": true }, this.getNodeParameter("firstName", itemIndex), this, itemIndex);
                        if (additionalFields["gender"] !== undefined)
                            setBodyField(body, { "name": "gender", "displayName": "Gender", "description": "Employee gender.", "type": "string", "enum": ["male", "female", "other"] }, additionalFields["gender"], this, itemIndex);
                        if (additionalFields["hireDate"] !== undefined)
                            setBodyField(body, { "name": "hireDate", "displayName": "Hire Date", "description": "Employee hire date. Use `dd/mm/yyyy`.", "type": "string", "example": "2019-10-31T23:00Z" }, additionalFields["hireDate"], this, itemIndex);
                        if (additionalFields["id"] !== undefined)
                            setBodyField(body, { "name": "id", "displayName": "Id", "description": "Employee ID.", "type": "integer", "format": "int64" }, additionalFields["id"], this, itemIndex);
                        setBodyField(body, { "name": "lastName", "displayName": "Last Name", "description": "Last name.", "type": "string", "required": true }, this.getNodeParameter("lastName", itemIndex), this, itemIndex);
                        if (additionalFields["nationalId"] !== undefined)
                            setBodyField(body, { "name": "nationalId", "displayName": "National Id", "description": "Employee national identification number.", "type": "string" }, additionalFields["nationalId"], this, itemIndex);
                        if (additionalFields["notes"] !== undefined)
                            setBodyField(body, { "name": "notes", "displayName": "Notes", "description": "Additional notes about the employee.", "type": "string" }, additionalFields["notes"], this, itemIndex);
                        if (additionalFields["phone"] !== undefined)
                            setBodyField(body, { "name": "phone", "displayName": "Phone", "description": "Phone number.", "type": "string" }, additionalFields["phone"], this, itemIndex);
                        if (additionalFields["phone2"] !== undefined)
                            setBodyField(body, { "name": "phone2", "displayName": "Phone2", "description": "Secondary phone number.", "type": "string" }, additionalFields["phone2"], this, itemIndex);
                        if (additionalFields["photo"] !== undefined)
                            setBodyField(body, { "name": "photo", "displayName": "Photo", "description": "Employee photo file ID.", "type": "integer", "format": "int64" }, additionalFields["photo"], this, itemIndex);
                        if (additionalFields["postalCode"] !== undefined)
                            setBodyField(body, { "name": "postalCode", "displayName": "Postal Code", "description": "Postal code.", "type": "string" }, additionalFields["postalCode"], this, itemIndex);
                        if (additionalFields["province"] !== undefined)
                            setBodyField(body, { "name": "province", "displayName": "Province", "description": "Province or state.", "type": "string" }, additionalFields["province"], this, itemIndex);
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links", "address", "birthDate", "city", "code", "country", "dateCreated", "dateModified", "email", "externalId", "firstName", "gender", "hireDate", "id", "lastName", "nationalId", "notes", "phone", "phone2", "photo", "postalCode", "province"], simplified: ["id", "email", "address", "birthDate", "city", "code", "country", "dateCreated", "dateModified", "externalId"] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If company is not found" }, "409": { "title": "Conflict. If data is invalid." } };
                        break;
                    }
                    case "deleteClients": {
                        let path = "/api/v1/companies/{companyId}/employees/{id}/clients";
                        const qs = {};
                        const headers = {};
                        let body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        body = normalizeParameterValue(this.getNodeParameter("bodyJson", itemIndex));
                        validateBodyValue(body, { "name": "bodyJson", "displayName": "Body", "type": "string", "required": true, "description": "Raw request body", "representation": "raw" }, "Body", this, itemIndex);
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "text/uri-list" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Employee is not found" } };
                        break;
                    }
                    case "deleteEmployee": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/employees/{id}";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["archive"] !== undefined)
                            qs["archive"] = additionalFields["archive"];
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Employee is not found" } };
                        break;
                    }
                    case "deleteEmployeePhoto": {
                        let path = "/api/v1/companies/{companyId}/employees/{id}/photo";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Employee is not found" } };
                        break;
                    }
                    case "deletePosition_1": {
                        let path = "/api/v1/companies/{companyId}/employees/{id}/position";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Employee is not found" } };
                        break;
                    }
                    case "deleteSubordinates": {
                        let path = "/api/v1/companies/{companyId}/employees/{id}/subordinates";
                        const qs = {};
                        const headers = {};
                        let body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        body = normalizeParameterValue(this.getNodeParameter("bodyJson", itemIndex));
                        validateBodyValue(body, { "name": "bodyJson", "displayName": "Body", "type": "string", "required": true, "description": "Raw request body", "representation": "raw" }, "Body", this, itemIndex);
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "text/uri-list" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Employee is not found" }, "409": { "title": "Conflict. If data is invalid, e.g. any Employee URI is not found" } };
                        break;
                    }
                    case "deleteSupervisor": {
                        let path = "/api/v1/companies/{companyId}/employees/{id}/supervisor";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Employee is not found" } };
                        break;
                    }
                    case "getClients": {
                        let path = "/api/v1/companies/{companyId}/employees/{id}/clients";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "301": { "title": "Moved permanently. Moved to '/companies/{companyId}/employees?providerId={id}'" } };
                        break;
                    }
                    case "getEmployee": {
                        let path = "/api/v1/companies/{companyId}/employees/{id}";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links", "address", "birthDate", "city", "code", "country", "dateCreated", "dateModified", "email", "externalId", "firstName", "gender", "hireDate", "id", "lastName", "nationalId", "notes", "phone", "phone2", "photo", "postalCode", "province"], simplified: ["id", "email", "address", "birthDate", "city", "code", "country", "dateCreated", "dateModified", "externalId"] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Employee is not found" } };
                        break;
                    }
                    case "getEmployeePhoto": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/employees/{id}/photo";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["alt"] !== undefined)
                            qs["alt"] = additionalFields["alt"];
                        if (additionalFields["accept"] !== undefined)
                            headers["accept"] = additionalFields["accept"];
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, headers: { ...headers }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links", "dateCreated", "dateModified", "height", "id", "mimeType", "name", "size", "width"], simplified: ["_embedded", "_links", "dateCreated", "dateModified", "height", "id", "mimeType", "name", "size", "width"] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If employee is not found or has not photo" } };
                        break;
                    }
                    case "getEmployees_1": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/employees";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        if (additionalFields["pageSize"] !== undefined)
                            qs["pageSize"] = additionalFields["pageSize"];
                        if (additionalFields["page"] !== undefined)
                            qs["page"] = additionalFields["page"];
                        if (additionalFields["supervisorId"] !== undefined)
                            qs["supervisorId"] = additionalFields["supervisorId"];
                        if (additionalFields["providerId"] !== undefined)
                            qs["providerId"] = additionalFields["providerId"];
                        if (additionalFields["positionId"] !== undefined)
                            qs["positionId"] = additionalFields["positionId"];
                        if (additionalFields["code"] !== undefined)
                            qs["code"] = additionalFields["code"];
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links", "total"], simplified: ["_embedded", "_links", "total"] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "409": { "title": "Conflict. If data is invalid." } };
                        break;
                    }
                    case "getFeedbackReports_1": {
                        let path = "/api/v1/companies/{companyId}/employees/{id}/feedback-reports";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links", "total"], simplified: ["_embedded", "_links", "total"] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Employee is not found" } };
                        break;
                    }
                    case "getPosition_1": {
                        let path = "/api/v1/companies/{companyId}/employees/{id}/position";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links", "code", "dateCreated", "dateModified", "enrolled", "id", "name", "required"], simplified: ["_embedded", "_links", "code", "dateCreated", "dateModified", "enrolled", "id", "name", "required"] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Employee or Position is not found" } };
                        break;
                    }
                    case "getSubordinates": {
                        let path = "/api/v1/companies/{companyId}/employees/{id}/subordinates";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "301": { "title": "Moved permanently. Moved to '/companies/{companyId}/employees?supervisorId={id}'" } };
                        break;
                    }
                    case "getSupervisor": {
                        let path = "/api/v1/companies/{companyId}/employees/{id}/supervisor";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links", "address", "birthDate", "city", "code", "country", "dateCreated", "dateModified", "email", "externalId", "firstName", "gender", "hireDate", "id", "lastName", "nationalId", "notes", "phone", "phone2", "photo", "postalCode", "province"], simplified: ["id", "email", "address", "birthDate", "city", "code", "country", "dateCreated", "dateModified", "externalId"] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If employee or supervisor is not found" } };
                        break;
                    }
                    case "setClients": {
                        let path = "/api/v1/companies/{companyId}/employees/{id}/clients";
                        const qs = {};
                        const headers = {};
                        let body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        body = normalizeParameterValue(this.getNodeParameter("bodyJson", itemIndex));
                        validateBodyValue(body, { "name": "bodyJson", "displayName": "Body", "type": "string", "required": true, "description": "Raw request body", "representation": "raw" }, "Body", this, itemIndex);
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "PUT", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "text/uri-list" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Employee is not found" } };
                        break;
                    }
                    case "setEmployeePhoto": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/employees/{id}/photo";
                        const qs = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["data"] !== undefined)
                            setBodyField(body, { "name": "data", "displayName": "Data", "description": "Image file to upload.", "type": "object", "representation": "raw" }, additionalFields["data"], this, itemIndex);
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, body: toFormData(body), json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links", "dateCreated", "dateModified", "height", "id", "mimeType", "name", "size", "width"], simplified: ["_embedded", "_links", "dateCreated", "dateModified", "height", "id", "mimeType", "name", "size", "width"] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Employee is not found" } };
                        break;
                    }
                    case "setPosition": {
                        let path = "/api/v1/companies/{companyId}/employees/{id}/position";
                        const qs = {};
                        const headers = {};
                        let body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        body = normalizeParameterValue(this.getNodeParameter("bodyJson", itemIndex));
                        validateBodyValue(body, { "name": "bodyJson", "displayName": "Body", "type": "string", "required": true, "description": "Raw request body", "representation": "raw" }, "Body", this, itemIndex);
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "PUT", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "text/uri-list" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Employee is not found" } };
                        break;
                    }
                    case "setSubordinates": {
                        let path = "/api/v1/companies/{companyId}/employees/{id}/subordinates";
                        const qs = {};
                        const headers = {};
                        let body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        body = normalizeParameterValue(this.getNodeParameter("bodyJson", itemIndex));
                        validateBodyValue(body, { "name": "bodyJson", "displayName": "Body", "type": "string", "required": true, "description": "Raw request body", "representation": "raw" }, "Body", this, itemIndex);
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "PUT", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "text/uri-list" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If employee is not found" }, "409": { "title": "Conflict. If data is invalid, e.g. any Employee URI is not found" } };
                        break;
                    }
                    case "setSupervisor": {
                        let path = "/api/v1/companies/{companyId}/employees/{id}/supervisor";
                        const qs = {};
                        const headers = {};
                        let body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        body = normalizeParameterValue(this.getNodeParameter("bodyJson", itemIndex));
                        validateBodyValue(body, { "name": "bodyJson", "displayName": "Body", "type": "string", "required": true, "description": "Raw request body", "representation": "raw" }, "Body", this, itemIndex);
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "PUT", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "text/uri-list" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Employee is not found" }, "409": { "title": "Conflict. If data is invalid, e.g. the Employee URI is invalid" } };
                        break;
                    }
                    case "updateEmployee": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/companies/{companyId}/employees/{id}";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{companyId}").join(encodeURIComponent(String(this.getNodeParameter("companyId", itemIndex))));
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["_embedded"] !== undefined)
                            setBodyField(body, { "name": "_embedded", "displayName": "Embedded", "description": "EmployeeEmbedded", "type": "object", "representation": "raw", "fields": [{ "name": "clients", "displayName": "Clients", "description": "List of employee's clients, if any", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "description": "Simplified Employee object with the most important data", "type": "object", "representation": "raw", "fields": [{ "name": "code", "displayName": "Code", "description": "Employee's code", "type": "string" }, { "name": "email", "displayName": "Email", "description": "Employee's email", "type": "string" }, { "name": "firstName", "displayName": "First Name", "description": "Employee's name", "type": "string" }, { "name": "id", "displayName": "Id", "description": "Employee's ID", "type": "integer", "format": "int64" }, { "name": "lastName", "displayName": "Last Name", "description": "Employee's last name or surname", "type": "string" }, { "name": "photo", "displayName": "Photo", "description": "Employee's photo ID", "type": "integer", "format": "int64" }] } }, { "name": "company", "displayName": "Company", "description": "Simplified Company object with the most important data", "type": "object", "representation": "raw", "fields": [{ "name": "id", "displayName": "Id", "description": "Company ID", "type": "integer", "format": "int64" }, { "name": "name", "displayName": "Name", "description": "Company name", "type": "string" }] }, { "name": "position", "displayName": "Position", "description": "Simplified Position object with the most important data", "type": "object", "representation": "raw", "fields": [{ "name": "code", "displayName": "Code", "description": "Position's code", "type": "string" }, { "name": "id", "displayName": "Id", "description": "Position's ID", "type": "integer", "format": "int64" }, { "name": "name", "displayName": "Name", "description": "Position's name", "type": "string" }] }, { "name": "supervisor", "displayName": "Supervisor", "description": "Simplified Employee object with the most important data", "type": "object", "representation": "raw", "fields": [{ "name": "code", "displayName": "Code", "description": "Employee's code", "type": "string" }, { "name": "email", "displayName": "Email", "description": "Employee's email", "type": "string" }, { "name": "firstName", "displayName": "First Name", "description": "Employee's name", "type": "string" }, { "name": "id", "displayName": "Id", "description": "Employee's ID", "type": "integer", "format": "int64" }, { "name": "lastName", "displayName": "Last Name", "description": "Employee's last name or surname", "type": "string" }, { "name": "photo", "displayName": "Photo", "description": "Employee's photo ID", "type": "integer", "format": "int64" }] }] }, additionalFields["_embedded"], this, itemIndex);
                        if (additionalFields["_links"] !== undefined)
                            setBodyField(body, { "name": "_links", "displayName": "Links", "description": "EmployeeLinks", "type": "object", "representation": "raw", "fields": [{ "name": "clients", "displayName": "Clients", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "company", "displayName": "Company", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "feedbackReports", "displayName": "Feedback Reports", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "photo", "displayName": "Photo", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "photoContent", "displayName": "Photo Content", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "position", "displayName": "Position", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "self", "displayName": "Self", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "subordinates", "displayName": "Subordinates", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "supervisor", "displayName": "Supervisor", "description": "administrators", "type": "object", "representation": "raw", "fields": [{ "name": "href", "displayName": "Href", "type": "string" }, { "name": "path", "displayName": "Path", "type": "string" }, { "name": "queryParams", "displayName": "Query Params", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }] }, additionalFields["_links"], this, itemIndex);
                        if (additionalFields["address"] !== undefined)
                            setBodyField(body, { "name": "address", "displayName": "Address", "description": "Employee address.", "type": "string" }, additionalFields["address"], this, itemIndex);
                        if (additionalFields["birthDate"] !== undefined)
                            setBodyField(body, { "name": "birthDate", "displayName": "Birth Date", "description": "Employee date of birth.", "type": "string", "example": "2019-10-31T23:00Z" }, additionalFields["birthDate"], this, itemIndex);
                        if (additionalFields["city"] !== undefined)
                            setBodyField(body, { "name": "city", "displayName": "City", "description": "City.", "type": "string" }, additionalFields["city"], this, itemIndex);
                        setBodyField(body, { "name": "code", "displayName": "Code", "description": "Employee code.", "type": "string", "required": true }, this.getNodeParameter("code", itemIndex), this, itemIndex);
                        if (additionalFields["country"] !== undefined)
                            setBodyField(body, { "name": "country", "displayName": "Country", "description": "Country.", "type": "string" }, additionalFields["country"], this, itemIndex);
                        if (additionalFields["dateCreated"] !== undefined)
                            setBodyField(body, { "name": "dateCreated", "displayName": "Date Created", "description": "Date the employee record was created.", "type": "string" }, additionalFields["dateCreated"], this, itemIndex);
                        if (additionalFields["dateModified"] !== undefined)
                            setBodyField(body, { "name": "dateModified", "displayName": "Date Modified", "description": "Date the employee record was last modified.", "type": "string" }, additionalFields["dateModified"], this, itemIndex);
                        setBodyField(body, { "name": "email", "displayName": "Email", "description": "Email address.", "type": "string", "required": true }, this.getNodeParameter("email", itemIndex), this, itemIndex);
                        if (additionalFields["externalId"] !== undefined)
                            setBodyField(body, { "name": "externalId", "displayName": "External Id", "description": "External employee ID. Prefix it with `external-id=` when using it in an API path.", "type": "string", "example": "external-id=123" }, additionalFields["externalId"], this, itemIndex);
                        setBodyField(body, { "name": "firstName", "displayName": "First Name", "description": "First name.", "type": "string", "required": true }, this.getNodeParameter("firstName", itemIndex), this, itemIndex);
                        if (additionalFields["gender"] !== undefined)
                            setBodyField(body, { "name": "gender", "displayName": "Gender", "description": "Employee gender.", "type": "string", "enum": ["male", "female", "other"] }, additionalFields["gender"], this, itemIndex);
                        if (additionalFields["hireDate"] !== undefined)
                            setBodyField(body, { "name": "hireDate", "displayName": "Hire Date", "description": "Employee hire date. Use `dd/mm/yyyy`.", "type": "string", "example": "2019-10-31T23:00Z" }, additionalFields["hireDate"], this, itemIndex);
                        if (additionalFields["idBody"] !== undefined)
                            setBodyField(body, { "name": "id", "displayName": "Id", "description": "Employee ID.", "type": "integer", "format": "int64" }, additionalFields["idBody"], this, itemIndex);
                        setBodyField(body, { "name": "lastName", "displayName": "Last Name", "description": "Last name.", "type": "string", "required": true }, this.getNodeParameter("lastName", itemIndex), this, itemIndex);
                        if (additionalFields["nationalId"] !== undefined)
                            setBodyField(body, { "name": "nationalId", "displayName": "National Id", "description": "Employee national identification number.", "type": "string" }, additionalFields["nationalId"], this, itemIndex);
                        if (additionalFields["notes"] !== undefined)
                            setBodyField(body, { "name": "notes", "displayName": "Notes", "description": "Additional notes about the employee.", "type": "string" }, additionalFields["notes"], this, itemIndex);
                        if (additionalFields["phone"] !== undefined)
                            setBodyField(body, { "name": "phone", "displayName": "Phone", "description": "Phone number.", "type": "string" }, additionalFields["phone"], this, itemIndex);
                        if (additionalFields["phone2"] !== undefined)
                            setBodyField(body, { "name": "phone2", "displayName": "Phone2", "description": "Secondary phone number.", "type": "string" }, additionalFields["phone2"], this, itemIndex);
                        if (additionalFields["photo"] !== undefined)
                            setBodyField(body, { "name": "photo", "displayName": "Photo", "description": "Employee photo file ID.", "type": "integer", "format": "int64" }, additionalFields["photo"], this, itemIndex);
                        if (additionalFields["postalCode"] !== undefined)
                            setBodyField(body, { "name": "postalCode", "displayName": "Postal Code", "description": "Postal code.", "type": "string" }, additionalFields["postalCode"], this, itemIndex);
                        if (additionalFields["province"] !== undefined)
                            setBodyField(body, { "name": "province", "displayName": "Province", "description": "Province or state.", "type": "string" }, additionalFields["province"], this, itemIndex);
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "PUT", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "*/*" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links", "address", "birthDate", "city", "code", "country", "dateCreated", "dateModified", "email", "externalId", "firstName", "gender", "hireDate", "id", "lastName", "nationalId", "notes", "phone", "phone2", "photo", "postalCode", "province"], simplified: ["id", "email", "address", "birthDate", "city", "code", "country", "dateCreated", "dateModified", "externalId"] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If Employee is not found" }, "409": { "title": "Conflict. If data is invalid." } };
                        break;
                    }
                    case "getFile": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/files/{id}";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["alt"] !== undefined)
                            qs["alt"] = additionalFields["alt"];
                        if (additionalFields["accept"] !== undefined)
                            headers["accept"] = additionalFields["accept"];
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, headers: { ...headers }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links", "dateCreated", "dateModified", "height", "id", "mimeType", "name", "size", "width"], simplified: ["_embedded", "_links", "dateCreated", "dateModified", "height", "id", "mimeType", "name", "size", "width"] };
                        errorPlan = { "403": { "title": "Forbidden. If insufficient permissions" }, "404": { "title": "Not found. If company is not found" } };
                        break;
                    }
                    case "getRoot": {
                        const path = "/api/v1";
                        const qs = {};
                        const body = {};
                        const serverBaseUrl = { url: "https://dev.hrider.net", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "hriderApi", "type": "apiKey", "location": "header", "parameter": "Authorization" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_embedded", "_links"], simplified: ["_embedded", "_links"] };
                        errorPlan = { "401": { "title": "Unauthorised" } };
                        break;
                    }
                    default: throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Unsupported operation ${operation} for node version ${nodeVersion}`, { itemIndex });
                }
                const returnAll = pagination.style !== 'none' ? Boolean((_a = nodeOptions.returnAll) !== null && _a !== void 0 ? _a : false) : false;
                const resultLimit = pagination.style !== 'none' && !returnAll ? Number((_b = nodeOptions.resultLimit) !== null && _b !== void 0 ? _b : 50) : Math.min(pagination.maxItems, Number.POSITIVE_INFINITY);
                const pageStartTime = Date.now();
                const seenCursors = new Map();
                const seenPages = new Map();
                let page = 1;
                let offset = 0;
                let cursor;
                let pagesFetched = 0;
                let estimatedBytes = 0;
                let finished = false;
                while (!finished && output.length - outputStart < resultLimit && pagesFetched < pagination.maxPages) {
                    if (Date.now() - pageStartTime > pagination.maxElapsedMs)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination elapsed-time budget was exceeded', { itemIndex });
                    const qs = options.qs;
                    if (pagination.limit && (pagesFetched > 0 || qs[pagination.limit] === undefined))
                        qs[pagination.limit] = Math.min(pagination.pageSize, resultLimit - (output.length - outputStart));
                    if (pagination.style === 'offset' && pagination.page)
                        qs[pagination.page] = offset;
                    if (pagination.style === 'pageNumber' && pagination.page)
                        qs[pagination.page] = page;
                    if (pagination.style === 'cursor' && pagination.cursor && cursor)
                        qs[pagination.cursor] = cursor;
                    const response = await (0, http_1.requestWithRetry)(this, options, credentialApplications, retryContract, itemIndex);
                    pagesFetched += 1;
                    const pageFingerprint = JSON.stringify(response);
                    const pageRepeats = ((_c = seenPages.get(pageFingerprint)) !== null && _c !== void 0 ? _c : 0) + 1;
                    seenPages.set(pageFingerprint, pageRepeats);
                    if (pageRepeats > pagination.repeatedPageLimit)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination repeated-page budget was exceeded', { itemIndex });
                    estimatedBytes += pageFingerprint.length;
                    if (estimatedBytes > pagination.maxMemoryBytes)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination memory budget was exceeded', { itemIndex });
                    if (responsePlan.binary) {
                        const binaryPayload = responsePlan.full ? ((_d = response.body) !== null && _d !== void 0 ? _d : response) : response;
                        const responseHeaders = (_e = (responsePlan.full ? response.headers : undefined)) !== null && _e !== void 0 ? _e : {};
                        const contentType = String((_f = responseHeaders['content-type']) !== null && _f !== void 0 ? _f : '').split(';')[0].trim() || 'application/octet-stream';
                        const binaryData = await this.helpers.prepareBinaryData(Buffer.from(binaryPayload), undefined, contentType);
                        output.push({ json: {}, binary: { data: binaryData }, pairedItem: { item: itemIndex } });
                        finished = true;
                        continue;
                    }
                    const normalizedResponse = responsePlan.full ? ((_g = response.body) !== null && _g !== void 0 ? _g : response) : response;
                    const envelopeValue = valueAtPath(normalizedResponse, responsePlan.envelopePath);
                    if (responsePlan.envelopePath && envelopeValue === undefined)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Response envelope path "${responsePlan.envelopePath}" was not found`, { itemIndex });
                    const envelope = (envelopeValue !== null && envelopeValue !== void 0 ? envelopeValue : normalizedResponse);
                    const itemPath = pagination.itemPath || responsePlan.itemPath;
                    const extractedItems = valueAtPath(envelope, itemPath);
                    if (itemPath && extractedItems === undefined)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Response item path "${itemPath}" was not found`, { itemIndex });
                    const deletedFallback = options.method === 'DELETE' && (normalizedResponse === undefined || normalizedResponse === null || normalizedResponse === '' ||
                        (typeof normalizedResponse === 'object' && !Array.isArray(normalizedResponse) && Object.keys(normalizedResponse).length === 0));
                    const values = deletedFallback
                        ? [{ deleted: true }]
                        : Array.isArray(extractedItems) ? extractedItems : Array.isArray(normalizedResponse) ? normalizedResponse : [extractedItems !== null && extractedItems !== void 0 ? extractedItems : envelope];
                    const outputMode = responsePlan.fields.length > 10 ? this.getNodeParameter('outputMode', itemIndex, 'simplified') : 'raw';
                    const selectedFields = outputMode === 'selected' ? this.getNodeParameter('selectedFields', itemIndex, []) : [];
                    for (const value of values) {
                        if (output.length - outputStart >= resultLimit)
                            break;
                        const fields = outputMode === 'simplified' ? responsePlan.simplified : outputMode === 'selected' ? selectedFields : [];
                        output.push({ json: selectResponseFields(value, fields), pairedItem: { item: itemIndex } });
                    }
                    if (!returnAll || pagination.style === 'none' || values.length === 0) {
                        finished = true;
                        continue;
                    }
                    if (pagination.hasMore && envelope[pagination.hasMore] === false) {
                        finished = true;
                        continue;
                    }
                    if (pagination.style === 'cursor') {
                        cursor = pagination.responseCursor ? valueAtPath(envelope, pagination.responseCursor) : undefined;
                        finished = !cursor;
                        if (cursor) {
                            const key = String(cursor);
                            const repeats = ((_h = seenCursors.get(key)) !== null && _h !== void 0 ? _h : 0) + 1;
                            seenCursors.set(key, repeats);
                            if (repeats > pagination.repeatedCursorLimit)
                                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination repeated-cursor budget was exceeded', { itemIndex });
                        }
                    }
                    if (pagination.advancement === 'offsetByItems')
                        offset += values.length;
                    if (pagination.advancement === 'incrementPage')
                        page += 1;
                }
            }
            catch (error) {
                if (this.continueOnFail()) {
                    output.push({ json: { error: error.message }, pairedItem: { item: itemIndex } });
                    continue;
                }
                if (error instanceof n8n_workflow_1.NodeApiError) {
                    const status = String((_l = (_j = error.httpCode) !== null && _j !== void 0 ? _j : (_k = error.cause) === null || _k === void 0 ? void 0 : _k.statusCode) !== null && _l !== void 0 ? _l : 'default');
                    const planned = (_m = errorPlan[status]) !== null && _m !== void 0 ? _m : errorPlan.default;
                    if (planned) {
                        const parameterHelp = planned.parameter ? `Check the '${planned.parameter}' parameter.` : undefined;
                        const description = [planned.recovery, parameterHelp].filter(Boolean).join(' ');
                        throw new n8n_workflow_1.NodeApiError(this.getNode(), error, { itemIndex, message: planned.title, description });
                    }
                }
                if (error instanceof n8n_workflow_1.NodeApiError)
                    throw new n8n_workflow_1.NodeApiError(this.getNode(), error, { itemIndex });
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), error, { itemIndex });
            }
        }
        return [output];
    }
}
exports.Hrider = Hrider;
//# sourceMappingURL=Hrider.node.js.map