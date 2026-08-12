# Website Content

Website Content 管理 PetCare 官网中可由平台运营人员维护并独立发布的页面内容和全局内容。

## Language

**Website Content**:
一个拥有独立草稿和发布历史的官网内容单元，例如首页或全局站点外壳。
_Avoid_: Website Document, site config, page config

**Content Version**:
Website Content 在某次保存或发布时形成的完整不可变内容版本。
_Avoid_: revision snapshot, config version

**Section**:
Website Content 内一个有稳定用途和内容结构的展示区域。
_Avoid_: block, widget, module

**Page Content**:
对应单个官网路由并独立发布的 Website Content。
_Avoid_: page document, page config

**Global Content**:
由多个官网页面共同使用并独立发布的 Website Content，例如导航和页脚。
_Avoid_: global config, common page

**Draft**:
不会被公开官网读取的 Content Version；继续编辑会创建新的 Draft，而不是修改原版本。
_Avoid_: staging content, unpublished page

**Published Version**:
当前可被公开官网读取的不可变 Content Version。
_Avoid_: live draft, active config

**Media Asset**:
可被 Section 引用的受管理官网图片。
_Avoid_: upload, image URL, attachment

**Preview**:
在不发布的情况下查看某个固定 Draft 修订的短时访问能力。
_Avoid_: staging deployment, public share
