import {
  Controller,
  Get,
  Post,
  Delete,
  UseGuards,
  Request,
  Put,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    const userId = req.user.userId;
    const userProfile = await this.usersService.findProfileByUserId(userId);

    const mainAddress =
      userProfile.enderecos?.find((e) => e.principal) ||
      userProfile.enderecos?.[0];

    return {
      user: {
        userId: userProfile.id,
        email: userProfile.email,
        nome: userProfile.nome,
        tipo: userProfile.tipo,
        phone: userProfile.telefone,
        cpf: userProfile.cpf,
        birthDate: userProfile.data_nascimento,
        avatarUrl: userProfile.avatarUrl,
        addresses:
          userProfile.enderecos?.map((end) => ({
            id: end.id,
            street: end.logradouro,
            number: end.numero,
            complement: end.complemento,
            neighborhood: end.bairro,
            city: end.cidade,
            state: end.estado,
            zip: end.cep,
            principal: end.principal,
          })) || [],
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  async updateProfile(@Request() req, @Body() body: any) {
    return this.usersService.updateProfile(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('internal')
  async getInternalUsers(@Query('q') search?: string) {
    return this.usersService.findAllInternal(search);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('clients')
  async getClientUsers(@Query('q') search?: string) {
    return this.usersService.findAllClients(search);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  async createUser(@Request() req, @Body() body: any) {
    let origin = req.headers.origin || req.headers.referer || process.env.FRONTEND_URL || 'https://icepoint.com.br';
    
    if (origin.endsWith('/')) {
      origin = origin.slice(0, -1);
    }

    return this.usersService.createAdminUser(body, origin);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put(':id')
  async editUser(@Param('id') id: string, @Body() body: any) {
    return this.usersService.adminUpdateUser(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('profile/avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @Request() req,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /(jpg|jpeg|png)$/ }), 
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.usersService.uploadAvatar(req.user.userId, file);
  }

  @Get()
  getPublicData() {
    return { message: 'Dados públicos acessíveis a todos.' };
  }
}
