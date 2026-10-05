# HRider n8n community node

HRider helps teams manage performance reviews, 360-degree feedback, and people analytics

Generated from OpenAPI 1.0 with template 1.1.0. Generated files are platform-managed and will be overwritten during regeneration.

## Authentication

Configure the generated API key credential in n8n before using the node.

## Supported operations

- `PUT /api/v1/administrators/{id}/change-password` - Change Administrator Password
  - Retry Contract: none
  - Pagination Contract: none
- `POST /api/v1/administrators` - Create Administrator
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /api/v1/administrators/{id}` - Delete Administrator
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/administrators/{id}` - Get Administrator
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/administrators` - List Administrators
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/administrators/{id}/companies` - List Assigned Companies
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /api/v1/administrators/{id}/companies` - Assign Companies to Administrator
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /api/v1/administrators/{id}/companies` - Remove Company Assignments
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /api/v1/administrators/{id}` - Update Administrator
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/appraisals/{appraisalId}` - Get Appraisal
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/appraisals` - List Appraisals
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/feedback-action-plan` - Download Feedback Action Plan Report
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/feedback-comments` - Download Feedback Comments Report
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/feedback-database-responses` - Download Evaluator Responses
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/feedback-detail` - Download Feedback Detail Report
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/feedback-group-detail` - Download Feedback Detail by Group
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/feedback-reports/{employeeId}` - Download Employee Feedback Report
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/feedback-reports` - List Feedback Reports
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/feedback-results-age` - Download Feedback Results by Age
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/feedback-results-antiquity` - Download Feedback Results by Tenure
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/feedback-results-gender` - Download Feedback Results by Gender
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/feedback-results-jobs` - Download Feedback Results by Job Position
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/feedback-results` - Download Feedback Results Report
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/appraisals/{appraisalId}/invitations/{employeeId}` - Get Invitation
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/appraisals/{appraisalId}/invitations` - List Invitations
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/nbox-results` - Download NBox Results Report
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/appraisals/{appraisalId}/reports` - List Reports
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/survey-list` - Download Survey List Report
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/work-env-age-gender` - Download Working Environment Results by Age,Gender
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/work-env-all` - Download Full Working Environment Report
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/work-env-antiquity` - Download Working Environment Results by Tenure
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/work-env-departments` - Download Working Environment Results by Department
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/work-env-groups` - Download Working Environment Results by Indicator
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/work-env-indicators` - Download Working Environment Results by Indicator
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/work-env-jobs` - Download Working Environment Results Job Position
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/work-env-feedback` - Download Working Environment Feedback Report
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/appraisals/{appraisalId}/reports/work-env` - Download Working Environment Report
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /api/v1/companies/{companyId}/appraisals/{appraisalId}/invitations/{employeeId}/resend` - Resend Appraisal Invitation
  - Retry Contract: none
  - Pagination Contract: none
- `POST /api/v1/companies` - Create Company
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /api/v1/companies/{id}` - Delete Company
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /api/v1/companies/{id}/logo` - Delete Company Logo
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{id}/administrators` - List Company Administrators
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies` - List Companies
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{id}` - Get Company
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{id}/logo` - Get Company Logo
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /api/v1/companies/{id}/administrators` - Assign Administrators to Company
  - Retry Contract: none
  - Pagination Contract: none
- `POST /api/v1/companies/{id}/logo` - Upload Company Logo
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /api/v1/companies/{id}/administrators` - Remove Company Administrators
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /api/v1/companies/{id}` - Update Company
  - Retry Contract: none
  - Pagination Contract: none
- `POST /api/v1/companies/{companyId}/departments` - Create Department
  - Retry Contract: none
  - Pagination Contract: none
- `POST /api/v1/companies/{companyId}/departments/{departmentId}/positions` - Create Job Position
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /api/v1/companies/{companyId}/departments/{id}` - Delete Department
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /api/v1/companies/{companyId}/departments/{departmentId}/positions/{positionId}/employees` - Unassign Employees from Position
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /api/v1/companies/{companyId}/departments/{departmentId}/positions/{positionId}` - Delete Job Position
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/departments/{departmentId}/children` - List Child Departments
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/departments/{departmentId}` - Get Department
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/departments` - List Departments
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/departments/{departmentId}/positions/{positionId}/employees` - List Position Employees
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/departments/{departmentId}/parent` - Get Parent Department
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/departments/{departmentId}/positions/{positionId}` - Get Job Position
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/departments/{departmentId}/positions` - List Job Positions
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /api/v1/companies/{companyId}/departments/{departmentId}/positions/{positionId}/move` - Move Position to Department
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /api/v1/companies/{companyId}/departments/{departmentId}/positions/{positionId}/employees` - Assign Employees to Position
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /api/v1/companies/{companyId}/departments/{departmentId}/parent` - Set Parent Department
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /api/v1/companies/{companyId}/departments/{departmentId}` - Update Department
  - Retry Contract: none
  - Pagination Contract: none
- `POST /api/v1/companies/{companyId}/employees` - Create Employee
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /api/v1/companies/{companyId}/employees/{id}/clients` - Remove Employee Clients
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /api/v1/companies/{companyId}/employees/{id}` - Archive or Delete Employee
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /api/v1/companies/{companyId}/employees/{id}/photo` - Delete Employee Photo
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /api/v1/companies/{companyId}/employees/{id}/position` - Unassign Employee Position
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /api/v1/companies/{companyId}/employees/{id}/subordinates` - Remove Subordinates
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /api/v1/companies/{companyId}/employees/{id}/supervisor` - Unassign Employee Supervisor
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/employees/{id}/clients` - List Employee Clients
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/employees/{id}` - Get Employee
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/employees/{id}/photo` - Get Employee Photo
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/employees` - List Employees
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/employees/{id}/feedback-reports` - List Employee Feedback Reports
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/employees/{id}/position` - Get Employee Position
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/employees/{id}/subordinates` - List Subordinates
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/companies/{companyId}/employees/{id}/supervisor` - Get Employee Supervisor
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /api/v1/companies/{companyId}/employees/{id}/clients` - Assign Clients to Employee
  - Retry Contract: none
  - Pagination Contract: none
- `POST /api/v1/companies/{companyId}/employees/{id}/photo` - Upload Employee Photo
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /api/v1/companies/{companyId}/employees/{id}/position` - Assign Employee Position
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /api/v1/companies/{companyId}/employees/{id}/subordinates` - Assign Subordinates
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /api/v1/companies/{companyId}/employees/{id}/supervisor` - Assign Employee Supervisor
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /api/v1/companies/{companyId}/employees/{id}` - Update Employee
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/files/{id}` - Get File
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1` - Discover API Resources
  - Retry Contract: none
  - Pagination Contract: none

## Usage

1. Install this community-node package in n8n.
2. Add the **HRider** node to a workflow.
3. Select a resource and operation, configure its parameters, and execute the workflow.

## Example workflow

Connect **Manual Trigger** -> **HRider** -> a destination node, select an operation, then run the workflow and inspect the returned items.

## Development

```sh
npm install
npm run build
npm run lint
npm run dev
```

`npm run dev` starts a local n8n development instance. Find the integration by its **HRider** display name.
