import { Body, Controller, Delete, Get, Post, Param, ParseUUIDPipe, Req, UploadedFile, UseGuards, UseInterceptors, HttpCode, HttpStatus, Header } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChatV1RequestDto, WorkspaceSearchDto, WorkspaceDecisionDto, WorkspaceCodeDto, WorkspaceTaskDto } from '@/dto';
import type { WorkspaceRequest, UploadedDocument } from '@/config';
import { WorkspaceGuard } from '../../../middleware/guards/workspace.guard.js';
import { WorkspaceService } from './workspace.service.js';

@ApiTags('Workspaces')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller({path:'workspaces',version:'1'})
export class WorkspaceController {
  constructor(private readonly service:WorkspaceService) {}
  @Post() @Header('Cache-Control','no-store') @ApiOperation({summary:'Create an expiring private workspace; save the returned access token'})
  create() {return this.service.store.create();}
  @Get(':id') @Header('Cache-Control','no-store') @ApiOperation({summary:'List workspace files and pending actions'})
  read(@Req() req:WorkspaceRequest) {return {id:req.workspace.id,expiresAt:req.workspace.expiresAt,files:this.service.files.list(req.workspace),approvals:this.service.store.approvals(req.workspace)};}
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) @ApiOperation({summary:'Cancel work and erase the workspace'})
  remove(@Req() req:WorkspaceRequest) {this.service.store.remove(req.workspace);}
  @Post(':id/files') @ApiOperation({summary:'Upload a UTF-8 TXT, MD, CSV, or JSON file, up to 1 MiB'})
  @ApiConsumes('multipart/form-data') @ApiBody({schema:{type:'object',required:['file'],properties:{file:{type:'string',format:'binary'}}}})
  @UseInterceptors(FileInterceptor('file',{limits:{fileSize:1_048_576,files:1,fields:0,parts:1}}))
  upload(@Req() req:WorkspaceRequest,@UploadedFile() file:UploadedDocument) {
    const result=this.service.files.upload(req.workspace,file);
    this.service.store.audit(req.workspace,{tool:'upload_file',tier:'write',traceId:req.workspace.id,input:{filename:result.filename,bytes:result.bytes},output:result,status:'succeeded'});
    return result;
  }
  @Post(':id/retrieve') @HttpCode(200) @ApiOperation({summary:'Retrieve cited chunks from this workspace only'})
  retrieve(@Req() req:WorkspaceRequest,@Body() body:WorkspaceSearchDto) {return this.service.files.search(req.workspace,body.query,body.fileIds);}
  @Post(':id/messages') @HttpCode(200) @ApiOperation({summary:'Chat with scoped files, tools, and approvals'})
  send(@Req() req:WorkspaceRequest,@Body() body:ChatV1RequestDto) {return this.service.send(req.workspace,body.message);}
  @Post(':id/code') @ApiOperation({summary:'Propose code execution for review; does not execute code'})
  code(@Req() req:WorkspaceRequest,@Body() body:WorkspaceCodeDto) {return this.service.store.propose(req.workspace,{tool:'execute_code',code:body.code});}
  @Post(':id/files/:fileId/delete') @ApiOperation({summary:'Propose file deletion for review'})
  deleteFile(@Req() req:WorkspaceRequest,@Param('fileId',new ParseUUIDPipe()) fileId:string) {return this.service.store.propose(req.workspace,{tool:'delete_file',fileId});}
  @Post(':id/approvals/:approvalId') @HttpCode(200) @ApiOperation({summary:'Approve, deny, or cancel the exact pending action once'})
  decide(@Req() req:WorkspaceRequest,@Param('approvalId',new ParseUUIDPipe()) id:string,@Body() body:WorkspaceDecisionDto) {return this.service.decide(req.workspace,id,body.decision);}
  @Post(':id/cancel') @HttpCode(200) @ApiOperation({summary:'Cancel active workspace execution'})
  cancel(@Req() req:WorkspaceRequest) {return this.service.cancel(req.workspace);}
  @Post(':id/delegate') @HttpCode(200) @ApiOperation({summary:'Run a bounded manager and specialist workflow'})
  delegate(@Req() req:WorkspaceRequest,@Body() body:WorkspaceTaskDto) {return this.service.delegate(req.workspace,body.task);}
  @Get(':id/audit') @Header('Cache-Control','no-store') @ApiOperation({summary:'Read bounded, redacted tool execution records'})
  audit(@Req() req:WorkspaceRequest) {return structuredClone(req.workspace.audit);}
}
